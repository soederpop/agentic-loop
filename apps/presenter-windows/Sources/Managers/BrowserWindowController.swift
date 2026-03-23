import AppKit
import AVFoundation
@preconcurrency
import WebKit

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

        let frame = NSRect(
            x: request.x ?? 200,
            y: request.y ?? 200,
            width: request.width,
            height: request.height
        )
        let window = NSWindow(
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
        NSApp.activate(ignoringOtherApps: true)
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
