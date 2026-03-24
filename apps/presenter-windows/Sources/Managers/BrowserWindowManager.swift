import AppKit
import Foundation

@MainActor
public final class BrowserWindowManager {
    public struct WindowLifecycleEvent {
        public enum EventType: String {
            case windowClosed
            case terminalExited
            case windowFocused
            case windowBlurred
        }

        public enum WindowKind: String {
            case browser
            case terminal
        }

        public let type: EventType
        public let windowId: UUID
        public let kind: WindowKind
        public let pid: Int?
        public let exitCode: Int?
        public let frame: WindowFrame?

        public init(type: EventType, windowId: UUID, kind: WindowKind, pid: Int? = nil, exitCode: Int? = nil, frame: WindowFrame? = nil) {
            self.type = type
            self.windowId = windowId
            self.kind = kind
            self.pid = pid
            self.exitCode = exitCode
            self.frame = frame
        }
    }

    private var windows: [UUID: any WindowControlling] = [:]
    private var browserWindows: [UUID: BrowserWindowController] = [:]
    private var mostRecentWindowId: UUID?
    public var onWindowLifecycleEvent: ((WindowLifecycleEvent) -> Void)?

    public init() {}

    public func bringManagedWindowsToFront() {
        guard !windows.isEmpty else { return }

        for (id, controller) in windows where id != mostRecentWindowId {
            controller.bringToFront()
        }

        if let mostRecentWindowId, let recentController = windows[mostRecentWindowId] {
            recentController.focus()
            return
        }

        if let firstController = windows.values.first {
            firstController.focus()
        }
    }

    public func handle(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        let action = command.action.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        switch action {
        case "open", "spawn":
            openWindow(command.request, completion: completion)
        case "terminal":
            openTerminal(command, completion: completion)
        case "focus":
            focusWindow(command.windowId, completion: completion)
        case "close":
            closeWindow(command.windowId, completion: completion)
        case "navigate":
            navigateWindow(command, completion: completion)
        case "eval":
            evaluateWindow(command, completion: completion)
        case "move":
            moveWindow(command, completion: completion)
        case "resize":
            resizeWindow(command, completion: completion)
        case "setframe":
            setWindowFrame(command, completion: completion)
        case "screengrab", "screenshot", "capture":
            captureWindow(command, completion: completion)
        case "video", "record":
            recordWindow(command, completion: completion)
        default:
            let error = "unsupported action=\(command.action)"
            AppLogger.error("window command rejected: \(error)")
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 1, userInfo: [NSLocalizedDescriptionKey: error])))
        }
    }

    private func openWindow(_ request: SpawnWindowRequest?, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        let resolvedRequest = request ?? SpawnWindowRequest(url: "about:blank")
        do {
            let id = UUID()
            let controller = try BrowserWindowController(
                windowId: id,
                request: resolvedRequest,
                onClosed: { [weak self] closedId in
                    self?.handleWindowClosed(id: closedId, kind: .browser)
                },
                onFocused: { [weak self] focusedId, frame in
                    self?.mostRecentWindowId = focusedId
                    self?.handleWindowFocusChanged(id: focusedId, kind: .browser, focused: true, frame: frame)
                },
                onBlurred: { [weak self] blurredId, frame in
                    self?.handleWindowFocusChanged(id: blurredId, kind: .browser, focused: false, frame: frame)
                }
            )
            windows[id] = controller
            browserWindows[id] = controller
            mostRecentWindowId = id
            controller.open()
            let snapshot = controller.snapshot()
            AppLogger.info("window opened id=\(id.uuidString) title=\(snapshot.title) url=\(snapshot.url)")
            completion(.success([
                "ok": .bool(true),
                "windowId": .string(id.uuidString),
                "title": .string(snapshot.title),
                "url": .string(snapshot.url)
            ]))
        } catch {
            AppLogger.error("window open failed: \(error.localizedDescription)")
            completion(.failure(error))
        }
    }

    private func focusWindow(_ windowId: String?, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        if let target = resolveTargetWindow(windowId) {
            let (uuid, controller) = target
            controller.focus()
            mostRecentWindowId = uuid
            completion(.success([
                "ok": .bool(true),
                "windowId": .string(uuid.uuidString)
            ]))
        } else {
            let error = "no target window"
            AppLogger.error("window focus failed: \(error)")
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: error])))
        }
    }

    private func closeWindow(_ windowId: String?, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        if let target = resolveTargetWindow(windowId) {
            let (uuid, controller) = target
            controller.closeWindow()
            completion(.success([
                "ok": .bool(true),
                "windowId": .string(uuid.uuidString)
            ]))
        } else {
            let error = "no target window"
            AppLogger.error("window close failed: \(error)")
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 3, userInfo: [NSLocalizedDescriptionKey: error])))
        }
    }

    private func navigateWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let urlString = command.request?.url?.trimmingCharacters(in: .whitespacesAndNewlines), !urlString.isEmpty else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 4, userInfo: [NSLocalizedDescriptionKey: "navigate requires url"])))
            return
        }
        guard let target = resolveBrowserWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }

        let (uuid, controller) = target
        do {
            try controller.navigate(urlString: urlString)
            completion(.success([
                "ok": .bool(true),
                "windowId": .string(uuid.uuidString),
                "url": .string(urlString)
            ]))
        } catch {
            completion(.failure(error))
        }
    }

    private func evaluateWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let code = command.code?.trimmingCharacters(in: .whitespacesAndNewlines), !code.isEmpty else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 5, userInfo: [NSLocalizedDescriptionKey: "eval requires code"])))
            return
        }
        guard let target = resolveBrowserWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }

        let timeoutMs = command.timeoutMs ?? 5000
        let returnJson = command.returnJson ?? true
        let (uuid, controller) = target

        controller.evaluate(code: code, timeoutMs: timeoutMs, returnJson: returnJson) { result in
            switch result {
            case .success(let payload):
                var response: [String: JSONValue] = [
                    "ok": .bool(true),
                    "windowId": .string(uuid.uuidString)
                ]
                for (key, value) in payload {
                    response[key] = JSONValue.from(any: value) ?? .null
                }
                completion(.success(response))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    private func openTerminal(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let executable = command.command?.trimmingCharacters(in: .whitespacesAndNewlines), !executable.isEmpty else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 6, userInfo: [NSLocalizedDescriptionKey: "terminal requires command"])))
            return
        }

        let id = UUID()
        do {
            let controller = try TerminalWindowController(
                windowId: id,
                request: command.request,
                command: executable,
                args: command.args ?? [],
                cwd: command.cwd,
                env: command.env,
                cols: command.cols,
                rows: command.rows,
                onClosed: { [weak self] closedId in
                    self?.handleWindowClosed(id: closedId, kind: .terminal)
                },
                onFocused: { [weak self] focusedId, frame in
                    self?.mostRecentWindowId = focusedId
                    self?.handleWindowFocusChanged(id: focusedId, kind: .terminal, focused: true, frame: frame)
                },
                onBlurred: { [weak self] blurredId, frame in
                    self?.handleWindowFocusChanged(id: blurredId, kind: .terminal, focused: false, frame: frame)
                },
                onProcessExit: { [weak self] windowId, pid, exitCode in
                    self?.emitWindowLifecycleEvent(
                        WindowLifecycleEvent(
                            type: .terminalExited,
                            windowId: windowId,
                            kind: .terminal,
                            pid: pid,
                            exitCode: exitCode
                        )
                    )
                }
            )
            windows[id] = controller
            mostRecentWindowId = id
            controller.open()
            let snapshot = controller.snapshot()
            AppLogger.info("terminal opened id=\(id.uuidString) command=\(snapshot.command)")
            var response: [String: JSONValue] = [
                "ok": .bool(true),
                "windowId": .string(id.uuidString),
                "title": .string(snapshot.title),
                "command": .string(snapshot.command)
            ]
            if let pid = snapshot.pid {
                response["pid"] = .number(Double(pid))
            }
            completion(.success(response))
        } catch {
            AppLogger.error("terminal open failed: \(error.localizedDescription)")
            completion(.failure(error))
        }
    }

    private func captureWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let rawPath = command.path?.trimmingCharacters(in: .whitespacesAndNewlines), !rawPath.isEmpty else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 7, userInfo: [NSLocalizedDescriptionKey: "screengrab requires path"])))
            return
        }
        guard let target = resolveTargetWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }

        let (uuid, controller) = target
        do {
            let capture = try controller.capturePNG(to: rawPath)
            completion(.success([
                "ok": .bool(true),
                "windowId": .string(uuid.uuidString),
                "path": .string(capture.path),
                "width": .number(Double(capture.width)),
                "height": .number(Double(capture.height))
            ]))
        } catch {
            completion(.failure(error))
        }
    }

    private func recordWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let rawPath = command.path?.trimmingCharacters(in: .whitespacesAndNewlines), !rawPath.isEmpty else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 8, userInfo: [NSLocalizedDescriptionKey: "video requires path"])))
            return
        }
        guard let target = resolveTargetWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }

        let (uuid, controller) = target
        guard let windowNumber = controller.windowNumberForCapture() else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 9, userInfo: [NSLocalizedDescriptionKey: "window capture handle unavailable"])))
            return
        }

        let durationMs = max(500, command.durationMs ?? 10_000)
        let durationSeconds = Double(durationMs) / 1000.0
        let durationArgument = String(format: "%.3f", durationSeconds)
        let expandedPath = (rawPath as NSString).expandingTildeInPath
        let outputURL = URL(fileURLWithPath: expandedPath)
        let directory = outputURL.deletingLastPathComponent()

        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        } catch {
            completion(.failure(error))
            return
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/sbin/screencapture")
        process.arguments = [
            "-x",
            "-v",
            "-l\(windowNumber)",
            "-V\(durationArgument)",
            expandedPath
        ]
        let stderrPipe = Pipe()
        process.standardError = stderrPipe

        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try process.run()
                process.waitUntilExit()

                let errorData = stderrPipe.fileHandleForReading.readDataToEndOfFile()
                let errorText = String(data: errorData, encoding: .utf8)?
                    .trimmingCharacters(in: .whitespacesAndNewlines)

                Task { @MainActor in
                    guard process.terminationStatus == 0 else {
                        let description = errorText?.isEmpty == false ? errorText! : "screen recording failed"
                        completion(.failure(NSError(domain: "BrowserWindowManager", code: 10, userInfo: [NSLocalizedDescriptionKey: description])))
                        return
                    }
                    completion(.success([
                        "ok": .bool(true),
                        "windowId": .string(uuid.uuidString),
                        "path": .string(expandedPath),
                        "durationMs": .number(Double(durationMs))
                    ]))
                }
            } catch {
                Task { @MainActor in
                    completion(.failure(error))
                }
            }
        }
    }

    private func moveWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let target = resolveTargetWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }
        let (uuid, controller) = target
        let x = command.request?.x
        let y = command.request?.y
        guard x != nil || y != nil else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 11, userInfo: [NSLocalizedDescriptionKey: "move requires x and/or y"])))
            return
        }
        controller.setFrame(x: x, y: y, width: nil, height: nil, animate: true)
        completion(.success([
            "ok": .bool(true),
            "windowId": .string(uuid.uuidString)
        ]))
    }

    private func resizeWindow(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let target = resolveTargetWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }
        let (uuid, controller) = target
        let w = command.request?.width
        let h = command.request?.height
        guard w != nil || h != nil else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 12, userInfo: [NSLocalizedDescriptionKey: "resize requires width and/or height"])))
            return
        }
        controller.setFrame(x: nil, y: nil, width: w, height: h, animate: true)
        completion(.success([
            "ok": .bool(true),
            "windowId": .string(uuid.uuidString)
        ]))
    }

    private func setWindowFrame(_ command: WindowCommand, completion: @escaping (Result<[String: JSONValue], Error>) -> Void) {
        guard let target = resolveTargetWindow(command.windowId) else {
            completion(.failure(NSError(domain: "BrowserWindowManager", code: 2, userInfo: [NSLocalizedDescriptionKey: "no target window"])))
            return
        }
        let (uuid, controller) = target
        let x = command.request?.x
        let y = command.request?.y
        let w = command.request?.width
        let h = command.request?.height
        controller.setFrame(x: x, y: y, width: w, height: h, animate: true)
        completion(.success([
            "ok": .bool(true),
            "windowId": .string(uuid.uuidString)
        ]))
    }

    private func resolveTargetWindow(_ windowId: String?) -> (UUID, any WindowControlling)? {
        if let windowId, let uuid = UUID(uuidString: windowId), let controller = windows[uuid] {
            return (uuid, controller)
        }
        if let mostRecentWindowId, let controller = windows[mostRecentWindowId] {
            return (mostRecentWindowId, controller)
        }
        return nil
    }

    private func resolveBrowserWindow(_ windowId: String?) -> (UUID, BrowserWindowController)? {
        if let windowId, let uuid = UUID(uuidString: windowId), let controller = browserWindows[uuid] {
            return (uuid, controller)
        }
        if let mostRecentWindowId, let controller = browserWindows[mostRecentWindowId] {
            return (mostRecentWindowId, controller)
        }
        return nil
    }

    private func removeWindow(id: UUID) {
        _ = windows.removeValue(forKey: id)
        _ = browserWindows.removeValue(forKey: id)
        if mostRecentWindowId == id {
            mostRecentWindowId = windows.keys.first
        }
    }

    private func handleWindowClosed(id: UUID, kind: WindowLifecycleEvent.WindowKind) {
        removeWindow(id: id)
        emitWindowLifecycleEvent(WindowLifecycleEvent(type: .windowClosed, windowId: id, kind: kind))
    }

    private func handleWindowFocusChanged(id: UUID, kind: WindowLifecycleEvent.WindowKind, focused: Bool, frame: NSRect) {
        let windowFrame = WindowFrame(x: frame.origin.x, y: frame.origin.y, width: frame.width, height: frame.height)
        let eventType: WindowLifecycleEvent.EventType = focused ? .windowFocused : .windowBlurred
        emitWindowLifecycleEvent(WindowLifecycleEvent(type: eventType, windowId: id, kind: kind, frame: windowFrame))
    }

    private func emitWindowLifecycleEvent(_ event: WindowLifecycleEvent) {
        onWindowLifecycleEvent?(event)
    }
}

@MainActor
private protocol WindowControlling: AnyObject {
    func focus()
    func bringToFront()
    func closeWindow()
    func setFrame(x: CGFloat?, y: CGFloat?, width: CGFloat?, height: CGFloat?, animate: Bool)
    func capturePNG(to path: String) throws -> WindowCaptureResult
    func windowNumberForCapture() -> Int?
}

extension BrowserWindowController: WindowControlling {}
extension TerminalWindowController: WindowControlling {}
