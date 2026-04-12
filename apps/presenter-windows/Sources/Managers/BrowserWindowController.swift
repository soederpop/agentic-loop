import AppKit
import AVFoundation
@preconcurrency
import WebKit

/// NSWindow subclass that fixes two issues with borderless WKWebView windows:
/// 1. Borderless windows don't become key/main by default, so clicks and key
///    events never reach the web view (broken cancel buttons, no focus).
/// 2. Arrow keys and other non-text keys trigger NSBeep via the default
///    keyDown handler even when the web view's JS handles them.
final class WebViewWindow: NSWindow {
    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { true }

    override func keyDown(with event: NSEvent) {
        // Cmd+R → reload the web view
        if event.modifierFlags.contains(.command), event.charactersIgnoringModifiers == "r" {
            if let webView = contentView as? WKWebView {
                webView.reload()
            }
            return
        }
        // Don't call super — it triggers NSBeep for keys the web view handles
        // (arrows, escape, etc.). The WKWebView already receives these via the
        // responder chain before NSWindow.keyDown is called.
    }
}

func topLeftYToAppKitY(_ topLeftY: CGFloat, height: CGFloat, screen: NSScreen?) -> CGFloat {
    guard let visibleFrame = screen?.visibleFrame else { return topLeftY }
    return visibleFrame.maxY - topLeftY - height
}

func appKitYToTopLeftY(_ appKitY: CGFloat, height: CGFloat, screen: NSScreen?) -> CGFloat {
    guard let visibleFrame = screen?.visibleFrame else { return appKitY }
    return visibleFrame.maxY - appKitY - height
}

@MainActor
final class BrowserWindowController: NSWindowController, NSWindowDelegate, WKNavigationDelegate, WKUIDelegate {
    let windowId: UUID
    private let webView: WKWebView
    private let onClosed: (UUID) -> Void
    private let onFocused: (UUID, NSRect) -> Void
    private let onBlurred: (UUID, NSRect) -> Void
    private(set) var lastKnownURL: String = "about:blank"
    private(set) var lastKnownTitle: String = "Untitled"

    init(
        windowId: UUID,
        request: SpawnWindowRequest,
        onClosed: @escaping (UUID) -> Void,
        onFocused: @escaping (UUID, NSRect) -> Void,
        onBlurred: @escaping (UUID, NSRect) -> Void
    ) throws {
        self.windowId = windowId
        self.onClosed = onClosed
        self.onFocused = onFocused
        self.onBlurred = onBlurred

        let config = WKWebViewConfiguration()
        webView = WKWebView(frame: .zero, configuration: config)

        let initialWidth = request.width
        let initialHeight = request.height
        let screen = NSScreen.main
        let frame = NSRect(
            x: request.x ?? 200,
            y: topLeftYToAppKitY(request.y ?? 200, height: initialHeight, screen: screen),
            width: initialWidth,
            height: initialHeight
        )
        let window = WebViewWindow(
            contentRect: frame,
            styleMask: Self.styleMask(for: request.window.decorations),
            backing: .buffered,
            defer: false
        )
        window.contentView = webView
        window.title = request.title ?? "Browser Window"
        window.canHide = false

        super.init(window: window)

        window.delegate = self
        webView.navigationDelegate = self
        webView.uiDelegate = self

        applyChrome(request.window)
        try loadInitialContent(request)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    func open() {
        showWindow(nil)
        focus()
    }

    func focus() {
        guard let window else { return }
        NSApp.foregroundForManagedWindow()
        window.makeKeyAndOrderFront(nil)
        window.makeFirstResponder(webView)
    }

    func bringToFront() {
        guard let window else { return }
        if window.isMiniaturized {
            window.deminiaturize(nil)
        }
        window.orderFrontRegardless()
    }

    func closeWindow() {
        window?.close()
    }

    func setFrame(x: CGFloat?, y: CGFloat?, width: CGFloat?, height: CGFloat?, animate: Bool) {
        guard let window else { return }
        let current = window.frame
        let resolvedWidth = width ?? current.width
        let resolvedHeight = height ?? current.height
        let resolvedY = y != nil
            ? topLeftYToAppKitY(y!, height: resolvedHeight, screen: window.screen ?? NSScreen.main)
            : current.origin.y
        let newFrame = NSRect(
            x: x ?? current.origin.x,
            y: resolvedY,
            width: resolvedWidth,
            height: resolvedHeight
        )
        window.setFrame(newFrame, display: true, animate: animate)
    }

    func capturePNG(to path: String) throws -> WindowCaptureResult {
        guard let window, let contentView = window.contentView else {
            throw NSError(domain: "BrowserWindowController", code: 4, userInfo: [NSLocalizedDescriptionKey: "window is unavailable"])
        }
        let bounds = contentView.bounds
        guard bounds.width > 0, bounds.height > 0 else {
            throw NSError(domain: "BrowserWindowController", code: 5, userInfo: [NSLocalizedDescriptionKey: "window has invalid size"])
        }
        guard let imageRep = contentView.bitmapImageRepForCachingDisplay(in: bounds) else {
            throw NSError(domain: "BrowserWindowController", code: 6, userInfo: [NSLocalizedDescriptionKey: "unable to allocate image buffer"])
        }
        contentView.cacheDisplay(in: bounds, to: imageRep)
        guard let pngData = imageRep.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "BrowserWindowController", code: 7, userInfo: [NSLocalizedDescriptionKey: "unable to encode PNG"])
        }

        let expandedPath = (path as NSString).expandingTildeInPath
        let outputURL = URL(fileURLWithPath: expandedPath)
        let directory = outputURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        try pngData.write(to: outputURL, options: .atomic)
        return WindowCaptureResult(
            path: expandedPath,
            width: Int(bounds.width.rounded()),
            height: Int(bounds.height.rounded())
        )
    }

    func windowNumberForCapture() -> Int? {
        window?.windowNumber
    }

    func navigate(urlString: String) throws {
        guard let url = URL(string: urlString) else {
            throw NSError(domain: "BrowserWindowController", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
        }
        webView.load(URLRequest(url: url))
        lastKnownURL = url.absoluteString
    }

    func evaluate(code: String, timeoutMs: Int, returnJson: Bool, completion: @escaping (Result<[String: Any], Error>) -> Void) {
        var js = code
        if returnJson {
            js = "JSON.stringify((\(code)))"
        }

        let finishQueue = DispatchQueue(label: "window.eval.finish.\(windowId.uuidString)")
        var isDone = false

        let finish: (Result<[String: Any], Error>) -> Void = { result in
            finishQueue.sync {
                guard !isDone else { return }
                isDone = true
                completion(result)
            }
        }

        webView.evaluateJavaScript(js) { value, error in
            if let error {
                finish(.failure(error))
                return
            }
            var result: [String: Any] = ["value": value ?? NSNull()]
            if returnJson, let str = value as? String,
               let data = str.data(using: .utf8),
               let parsed = try? JSONSerialization.jsonObject(with: data) {
                result["json"] = parsed
            }
            finish(.success(result))
        }

        let timeout = max(100, timeoutMs)
        DispatchQueue.global().asyncAfter(deadline: .now() + .milliseconds(timeout)) {
            finish(.failure(NSError(domain: "BrowserWindowController", code: 3, userInfo: [NSLocalizedDescriptionKey: "JavaScript evaluation timed out"])))
        }
    }

    func snapshot() -> (url: String, title: String) {
        (lastKnownURL, lastKnownTitle)
    }

    func managedWindowState() -> ManagedWindowState? {
        guard let window else { return nil }
        let frame = window.frame
        return ManagedWindowState(
            windowId: windowId,
            kind: BrowserWindowManager.WindowLifecycleEvent.WindowKind.browser.rawValue,
            title: lastKnownTitle,
            frame: WindowFrame(
                x: frame.origin.x,
                y: appKitYToTopLeftY(frame.origin.y, height: frame.height, screen: window.screen ?? NSScreen.main),
                width: frame.width,
                height: frame.height
            ),
            focused: window.isKeyWindow,
            url: lastKnownURL
        )
    }

    func windowWillClose(_ notification: Notification) {
        onClosed(windowId)
    }

    func windowDidBecomeKey(_ notification: Notification) {
        let frame = window?.frame ?? .zero
        onFocused(windowId, frame)
    }

    func windowDidResignKey(_ notification: Notification) {
        let frame = window?.frame ?? .zero
        onBlurred(windowId, frame)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        lastKnownURL = webView.url?.absoluteString ?? lastKnownURL
        lastKnownTitle = webView.title ?? "Untitled"
        window?.title = lastKnownTitle
    }

    @available(macOS 12.0, *)
    func webView(
        _ webView: WKWebView,
        requestMediaCapturePermissionFor origin: WKSecurityOrigin,
        initiatedByFrame frame: WKFrameInfo,
        type: WKMediaCaptureType,
        decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
        requestSystemMediaAccess(for: type) { granted in
            decisionHandler(granted ? .grant : .deny)
        }
    }

    private func requestSystemMediaAccess(for type: WKMediaCaptureType, completion: @escaping (Bool) -> Void) {
        switch type {
        case .camera:
            requestCaptureAccess(for: .video, completion: completion)
        case .microphone:
            requestCaptureAccess(for: .audio, completion: completion)
        case .cameraAndMicrophone:
            requestCaptureAccess(for: .video) { videoGranted in
                guard videoGranted else {
                    completion(false)
                    return
                }
                self.requestCaptureAccess(for: .audio, completion: completion)
            }
        @unknown default:
            completion(true)
        }
    }

    private func requestCaptureAccess(for mediaType: AVMediaType, completion: @escaping (Bool) -> Void) {
        switch AVCaptureDevice.authorizationStatus(for: mediaType) {
        case .authorized:
            completion(true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: mediaType) { granted in
                completion(granted)
            }
        case .denied, .restricted:
            completion(false)
        @unknown default:
            completion(false)
        }
    }

    private static func styleMask(for decorations: String) -> NSWindow.StyleMask {
        switch decorations.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() {
        case "none":
            return [.borderless, .resizable]
        case "hiddentitlebar":
            return [.titled, .resizable, .fullSizeContentView]
        default:
            return [.titled, .resizable, .closable, .miniaturizable]
        }
    }

    private func applyChrome(_ options: SpawnWindowOptions) {
        guard let window else { return }
        let normalizedDecorations = options.decorations.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()

        switch normalizedDecorations {
        case "hiddentitlebar":
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.standardWindowButton(.closeButton)?.isHidden = true
            window.standardWindowButton(.miniaturizeButton)?.isHidden = true
            window.standardWindowButton(.zoomButton)?.isHidden = true
        case "none":
            window.titleVisibility = .hidden
            window.titlebarAppearsTransparent = true
            window.isMovableByWindowBackground = true
        default:
            break
        }

        if options.transparent || normalizedDecorations == "none" {
            window.isOpaque = false
            window.backgroundColor = .clear
            if #available(macOS 12.0, *) {
                webView.underPageBackgroundColor = .clear
            }
            webView.setValue(false, forKey: "drawsBackground")
        }

        window.hasShadow = options.shadow
        window.alphaValue = CGFloat(options.opacity)
        window.ignoresMouseEvents = options.clickThrough
        window.level = options.alwaysOnTop ? .floating : .normal
    }

    private func loadInitialContent(_ request: SpawnWindowRequest) throws {
        let hasURL = request.url != nil
        let hasHTML = request.html != nil
        guard hasURL != hasHTML else {
            throw NSError(domain: "BrowserWindowController", code: 1, userInfo: [NSLocalizedDescriptionKey: "Exactly one of url or html is required"])
        }

        if let urlString = request.url {
            guard let url = URL(string: urlString) else {
                throw NSError(domain: "BrowserWindowController", code: 2, userInfo: [NSLocalizedDescriptionKey: "Invalid URL"])
            }
            webView.load(URLRequest(url: url))
            lastKnownURL = url.absoluteString
            return
        }

        if let html = request.html {
            webView.loadHTMLString(html, baseURL: nil)
            lastKnownURL = "about:blank"
        }
    }
}
