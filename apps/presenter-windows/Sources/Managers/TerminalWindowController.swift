import AppKit
import Darwin
import Foundation
import SwiftTerm

@MainActor
final class TerminalWindowController: NSWindowController, NSWindowDelegate, @preconcurrency TerminalViewDelegate {
    let windowId: UUID
    private let terminalView: TerminalView
    private let onClosed: (UUID) -> Void
    private let onFocused: (UUID) -> Void
    private let onProcessExit: (UUID, Int, Int) -> Void
    private let ioQueue = DispatchQueue(label: "terminal.io.queue", qos: .userInitiated)
    private var readSource: DispatchSourceRead?
    private var masterFD: Int32 = -1
    private var slaveFD: Int32 = -1
    private var process: Process?
    private var ioChunkCount: Int = 0
    private(set) var lastKnownTitle: String
    private(set) var lastKnownCommand: String

    init(
        windowId: UUID,
        request: SpawnWindowRequest?,
        command: String,
        args: [String],
        cwd: String?,
        env: [String: String]?,
        cols: Int?,
        rows: Int?,
        onClosed: @escaping (UUID) -> Void,
        onFocused: @escaping (UUID) -> Void,
        onProcessExit: @escaping (UUID, Int, Int) -> Void
    ) throws {
        self.windowId = windowId
        self.onClosed = onClosed
        self.onFocused = onFocused
        self.onProcessExit = onProcessExit
        self.lastKnownCommand = ([command] + args).joined(separator: " ")
        self.lastKnownTitle = request?.title ?? "Terminal"

        let frame = NSRect(
            x: request?.x ?? 220,
            y: request?.y ?? 220,
            width: request?.width ?? 920,
            height: request?.height ?? 640
        )

        terminalView = TerminalView(frame: .zero)
        terminalView.font = NSFont.monospacedSystemFont(ofSize: 12, weight: .regular)
        terminalView.terminalDelegate = nil

        let window = NSWindow(
            contentRect: frame,
            styleMask: Self.styleMask(for: request?.window.decorations ?? "normal"),
            backing: .buffered,
            defer: false
        )
        window.contentView = terminalView
        window.title = lastKnownTitle
        window.canHide = false

        super.init(window: window)
        terminalView.terminalDelegate = self
        window.delegate = self
        applyChrome(request?.window ?? .init())

        try spawnProcess(command: command, args: args, cwd: cwd, env: env, cols: cols, rows: rows)
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
        window.makeFirstResponder(terminalView)
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
            throw NSError(domain: "TerminalWindowController", code: 12, userInfo: [NSLocalizedDescriptionKey: "window is unavailable"])
        }
        let bounds = contentView.bounds
        guard bounds.width > 0, bounds.height > 0 else {
            throw NSError(domain: "TerminalWindowController", code: 13, userInfo: [NSLocalizedDescriptionKey: "window has invalid size"])
        }
        guard let imageRep = contentView.bitmapImageRepForCachingDisplay(in: bounds) else {
            throw NSError(domain: "TerminalWindowController", code: 14, userInfo: [NSLocalizedDescriptionKey: "unable to allocate image buffer"])
        }
        contentView.cacheDisplay(in: bounds, to: imageRep)
        guard let pngData = imageRep.representation(using: .png, properties: [:]) else {
            throw NSError(domain: "TerminalWindowController", code: 15, userInfo: [NSLocalizedDescriptionKey: "unable to encode PNG"])
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

    func snapshot() -> (title: String, command: String, pid: Int?) {
        (lastKnownTitle, lastKnownCommand, process.map { Int($0.processIdentifier) })
    }

    func windowWillClose(_ notification: Notification) {
        tearDownProcess()
        onClosed(windowId)
    }

    func windowDidBecomeKey(_ notification: Notification) {
        onFocused(windowId)
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
        }

        window.hasShadow = options.shadow
        window.alphaValue = CGFloat(options.opacity)
        window.ignoresMouseEvents = options.clickThrough
        window.level = options.alwaysOnTop ? .floating : .normal
    }

    private func spawnProcess(
        command: String,
        args: [String],
        cwd: String?,
        env: [String: String]?,
        cols: Int?,
        rows: Int?
    ) throws {
        var winsizeConfig = winsize()
        winsizeConfig.ws_col = UInt16(max(20, min(cols ?? 120, 800)))
        winsizeConfig.ws_row = UInt16(max(10, min(rows ?? 40, 400)))

        let ptyResult = openpty(&masterFD, &slaveFD, nil, nil, &winsizeConfig)
        guard ptyResult == 0 else {
            throw NSError(domain: "TerminalWindowController", code: 10, userInfo: [NSLocalizedDescriptionKey: "Failed to allocate PTY"])
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-lc", bootstrapShellCommand(command: command, args: args)]
        process.environment = mergedEnvironment(extra: env)
        AppLogger.info("terminal spawn executable=\(process.executableURL?.path ?? "nil") args=\(process.arguments ?? []) cwd=\(cwd ?? "<none>")")

        if let cwd, !cwd.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            let expanded = (cwd as NSString).expandingTildeInPath
            var isDirectory: ObjCBool = false
            let exists = FileManager.default.fileExists(atPath: expanded, isDirectory: &isDirectory)
            guard exists, isDirectory.boolValue else {
                throw NSError(domain: "TerminalWindowController", code: 11, userInfo: [NSLocalizedDescriptionKey: "Invalid cwd path"])
            }
            process.currentDirectoryURL = URL(fileURLWithPath: expanded, isDirectory: true)
        }

        let slaveInput = FileHandle(fileDescriptor: slaveFD, closeOnDealloc: false)
        let slaveOutput = FileHandle(fileDescriptor: dup(slaveFD), closeOnDealloc: true)
        let slaveError = FileHandle(fileDescriptor: dup(slaveFD), closeOnDealloc: true)
        process.standardInput = slaveInput
        process.standardOutput = slaveOutput
        process.standardError = slaveError
        process.terminationHandler = { [weak self] process in
            Task { @MainActor [weak self] in
                guard let self else { return }
                let pid = Int(process.processIdentifier)
                let exitCode = Int(process.terminationStatus)
                AppLogger.info("terminal process exited pid=\(process.processIdentifier) status=\(process.terminationStatus)")
                self.appendPlain("\n\n[process exited \(process.terminationStatus)]\n")
                self.onProcessExit(self.windowId, pid, exitCode)
            }
        }

        do {
            try process.run()
            self.process = process
            lastKnownTitle = "\(lastKnownTitle) • \(process.processIdentifier)"
            window?.title = lastKnownTitle
            Darwin.close(slaveFD)
            slaveFD = -1
            startReadingMaster()
            appendPlain("[pid \(process.processIdentifier)] \(lastKnownCommand)\n\n")
            if let workingDirectory = process.currentDirectoryURL?.path, !workingDirectory.isEmpty {
                appendPlain("[cwd] \(workingDirectory)\n\n")
            }
        } catch {
            tearDownProcess()
            throw error
        }
    }

    private func startReadingMaster() {
        guard masterFD >= 0 else { return }
        let source = DispatchSource.makeReadSource(fileDescriptor: masterFD, queue: ioQueue)
        source.setEventHandler { [weak self] in
            guard let self else { return }
            var buffer = [UInt8](repeating: 0, count: 8192)
            let count = read(self.masterFD, &buffer, buffer.count)
            if count <= 0 {
                AppLogger.info("terminal pty read ended count=\(count)")
                source.cancel()
                return
            }
            self.ioChunkCount += 1
            let data = Data(buffer.prefix(count))
            let text = String(decoding: data, as: UTF8.self)
            if self.ioChunkCount <= 10 || self.ioChunkCount % 50 == 0 {
                AppLogger.info("terminal pty chunk=\(self.ioChunkCount) bytes=\(count) preview=\(self.logPreview(text))")
            }
            DispatchQueue.main.async {
                let bytes = ArraySlice(Array(data))
                self.terminalView.feed(byteArray: bytes)
            }
        }
        source.setCancelHandler { [weak self] in
            guard let self else { return }
            if self.masterFD >= 0 {
                Darwin.close(self.masterFD)
                self.masterFD = -1
            }
        }
        readSource = source
        source.resume()
    }

    private func appendPlain(_ text: String) {
        terminalView.feed(text: text)
    }

    private func mergedEnvironment(extra: [String: String]?) -> [String: String] {
        var merged = ProcessInfo.processInfo.environment
        if merged["TERM"] == nil {
            merged["TERM"] = "xterm-256color"
        }
        extra?.forEach { key, value in
            merged[key] = value
        }
        return merged
    }

    private func shellCommand(command: String, args: [String]) -> String {
        if args.isEmpty {
            return command
        }
        return ([command] + args).map(shellQuote).joined(separator: " ")
    }

    private func bootstrapShellCommand(command: String, args: [String]) -> String {
        let userCommand = shellCommand(command: command, args: args)
        return [
            "if [ -r ~/.zprofile ]; then source ~/.zprofile; fi",
            "if [ -r ~/.zshrc ]; then source ~/.zshrc; fi",
            userCommand
        ].joined(separator: "; ")
    }

    private func shellQuote(_ value: String) -> String {
        if value.isEmpty {
            return "''"
        }
        return "'" + value.replacingOccurrences(of: "'", with: "'\\''") + "'"
    }

    private func tearDownProcess() {
        readSource?.cancel()
        readSource = nil
        if masterFD >= 0 {
            Darwin.close(masterFD)
            masterFD = -1
        }
        if slaveFD >= 0 {
            Darwin.close(slaveFD)
            slaveFD = -1
        }
        if let process, process.isRunning {
            process.terminate()
        }
        process = nil
    }

    private func logPreview(_ text: String) -> String {
        let sanitized = text
            .replacingOccurrences(of: "\u{001B}", with: "\\e")
            .replacingOccurrences(of: "\n", with: "\\n")
            .replacingOccurrences(of: "\r", with: "\\r")
        if sanitized.count <= 180 {
            return sanitized
        }
        let endIndex = sanitized.index(sanitized.startIndex, offsetBy: 180)
        return String(sanitized[..<endIndex]) + "..."
    }

    func send(source: TerminalView, data: ArraySlice<UInt8>) {
        guard masterFD >= 0, !data.isEmpty else { return }
        _ = data.withUnsafeBytes { ptr in
            write(masterFD, ptr.baseAddress!, data.count)
        }
    }

    func scrolled(source: TerminalView, position: Double) {}

    func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
        guard masterFD >= 0 else { return }
        var ws = winsize()
        ws.ws_col = UInt16(max(20, min(newCols, 800)))
        ws.ws_row = UInt16(max(10, min(newRows, 400)))
        _ = ioctl(masterFD, TIOCSWINSZ, &ws)
    }

    func setTerminalTitle(source: TerminalView, title: String) {
        window?.title = title
    }

    func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {}

    func requestOpenLink(source: TerminalView, link: String, params: [String: String]) {
        guard let url = URL(string: link) else { return }
        NSWorkspace.shared.open(url)
    }

    func bell(source: TerminalView) {
        NSSound.beep()
    }

    func clipboardCopy(source: TerminalView, content: Data) {
        guard let string = String(data: content, encoding: .utf8), !string.isEmpty else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(string, forType: .string)
    }

    func iTermContent(source: TerminalView, content: ArraySlice<UInt8>) {}

    func rangeChanged(source: TerminalView, startY: Int, endY: Int) {}
}
