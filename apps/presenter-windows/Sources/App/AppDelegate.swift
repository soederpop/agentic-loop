import AppKit
import Carbon.HIToolbox

@MainActor
public final class AppDelegate: NSObject, NSApplicationDelegate {
    private var appController: AppController?
    private var startupProcess: Process?

    public func applicationDidFinishLaunching(_ notification: Notification) {
        let pid = ProcessInfo.processInfo.processIdentifier
        AppLogger.info("applicationDidFinishLaunching pid=\(pid)")
        NSApp.setActivationPolicy(.regular)

        let settings = SettingsManager.shared
        let windowManager = BrowserWindowManager()
        let windowIPCClient = IPCClient(socketPath: settings.windowSocketPath)
        let appController = AppController(
            settings: settings,
            windowIPCClient: windowIPCClient,
            windowManager: windowManager
        )

        self.appController = appController
        launchStartupCommandIfConfigured(settings: settings)
        appController.start()

        // Register existing hotkey (Cmd+Opt+L) with id 0
        HotkeyManager.shared.register(
            id: 0,
            keyCode: settings.hotkeyKeyCode,
            modifiers: settings.hotkeyModifiers
        ) {
            AppLogger.info("primary hotkey triggered")
        }

        // Register Ctrl+Space (id 1) — sends hotkeyTrigger to open the assistant picker
        HotkeyManager.shared.register(
            id: 1,
            keyCode: UInt32(0x31),       // kVK_Space
            modifiers: UInt32(0x1000)   // controlKey
        ) {
            AppLogger.info("assistant picker hotkey triggered (ctrl+space)")
            windowIPCClient.sendHotkeyTrigger()
        }

        AppLogger.info("window manager app initialized")
    }

    public func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }

    public func applicationDidBecomeActive(_ notification: Notification) {
        appController?.handleApplicationActivated()
    }

    public func applicationWillTerminate(_ notification: Notification) {
        let pid = ProcessInfo.processInfo.processIdentifier
        AppLogger.error("applicationWillTerminate pid=\(pid)")
        if let startupProcess, startupProcess.isRunning {
            startupProcess.terminate()
            AppLogger.info("startup command process terminated on app shutdown")
        }
    }

    private func launchStartupCommandIfConfigured(settings: SettingsManager) {
        let command = settings.startupCommand.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !command.isEmpty else { return }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/zsh")
        process.arguments = ["-ilc", command]
        process.currentDirectoryURL = startupWorkingDirectoryURL(from: settings.startupCommandWorkingDirectory)
        process.environment = ProcessInfo.processInfo.environment
        process.terminationHandler = { process in
            AppLogger.info("startup command exited status=\(process.terminationStatus)")
        }

        do {
            try process.run()
            startupProcess = process
            AppLogger.info("startup command launched pid=\(process.processIdentifier) command=\(command)")
        } catch {
            AppLogger.error("failed to launch startup command: \(error.localizedDescription)")
        }
    }

    private func startupWorkingDirectoryURL(from configuredPath: String) -> URL {
        let trimmed = configuredPath.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return FileManager.default.homeDirectoryForCurrentUser
        }

        let expanded = (trimmed as NSString).expandingTildeInPath
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(atPath: expanded, isDirectory: &isDirectory)
        guard exists, isDirectory.boolValue else {
            AppLogger.error("invalid startup working directory path=\(expanded); falling back to home directory")
            return FileManager.default.homeDirectoryForCurrentUser
        }

        return URL(fileURLWithPath: expanded, isDirectory: true)
    }
}
