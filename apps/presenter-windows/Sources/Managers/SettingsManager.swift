import Foundation
import Combine
import Carbon.HIToolbox

@MainActor
public final class SettingsManager: ObservableObject {
    public static let shared = SettingsManager()

    public struct Keys {
        static let hotkeyKeyCode = "settings.hotkey.keyCode"
        static let hotkeyModifiers = "settings.hotkey.modifiers"
        static let hotkeyMigration202602 = "settings.hotkey.migration.202602"
        static let micAutoOn = "settings.mic.autoOn"
        static let speechVoiceIdentifier = "settings.speech.voiceIdentifier"
        static let commandSocketPath = "settings.ipc.commandSocketPath"
        static let windowSocketPath = "settings.ipc.windowSocketPath"
        static let timeoutSeconds = "settings.ipc.timeout"
        static let historyLimit = "settings.history.limit"
        static let runAtLogin = "settings.lifecycle.runAtLogin"
        static let startupCommand = "settings.lifecycle.startupCommand"
        static let startupCommandWorkingDirectory = "settings.lifecycle.startupCommandWorkingDirectory"
        static let closeOnOutsideClick = "settings.ui.closeOnOutsideClick"
    }

    @Published public var hotkeyKeyCode: UInt32 {
        didSet { defaults.set(Int(hotkeyKeyCode), forKey: Keys.hotkeyKeyCode) }
    }

    @Published public var hotkeyModifiers: UInt32 {
        didSet { defaults.set(Int(hotkeyModifiers), forKey: Keys.hotkeyModifiers) }
    }

    @Published public var micAutoOn: Bool {
        didSet { defaults.set(micAutoOn, forKey: Keys.micAutoOn) }
    }

    @Published public var speechVoiceIdentifier: String {
        didSet { defaults.set(speechVoiceIdentifier, forKey: Keys.speechVoiceIdentifier) }
    }

    @Published public var commandSocketPath: String {
        didSet { defaults.set(commandSocketPath, forKey: Keys.commandSocketPath) }
    }

    @Published public var windowSocketPath: String {
        didSet { defaults.set(windowSocketPath, forKey: Keys.windowSocketPath) }
    }

    @Published public var timeoutSeconds: Int {
        didSet { defaults.set(timeoutSeconds, forKey: Keys.timeoutSeconds) }
    }

    @Published public var historyLimit: Int {
        didSet { defaults.set(historyLimit, forKey: Keys.historyLimit) }
    }

    @Published public var runAtLogin: Bool {
        didSet { defaults.set(runAtLogin, forKey: Keys.runAtLogin) }
    }

    @Published public var startupCommand: String {
        didSet { defaults.set(startupCommand, forKey: Keys.startupCommand) }
    }

    @Published public var startupCommandWorkingDirectory: String {
        didSet { defaults.set(startupCommandWorkingDirectory, forKey: Keys.startupCommandWorkingDirectory) }
    }

    @Published public var closeOnOutsideClick: Bool {
        didSet { defaults.set(closeOnOutsideClick, forKey: Keys.closeOnOutsideClick) }
    }

    private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults

        let defaultCommandSocketPath = Self.defaultCommandSocketPath()
        let defaultWindowSocketPath = Self.defaultWindowSocketPath()

        let hasStoredKeyCode = defaults.object(forKey: Keys.hotkeyKeyCode) != nil
        let hasStoredModifiers = defaults.object(forKey: Keys.hotkeyModifiers) != nil
        let storedKeyCode = defaults.integer(forKey: Keys.hotkeyKeyCode)
        let storedModifiers = defaults.integer(forKey: Keys.hotkeyModifiers)
        let newDefaultKeyCode = Int(kVK_ANSI_L)
        let newDefaultModifiers = Int(cmdKey | optionKey)

        let migrationDone = defaults.bool(forKey: Keys.hotkeyMigration202602)
        if !migrationDone && storedKeyCode == Int(kVK_Space) && storedModifiers == Int(cmdKey) {
            defaults.set(newDefaultKeyCode, forKey: Keys.hotkeyKeyCode)
            defaults.set(newDefaultModifiers, forKey: Keys.hotkeyModifiers)
        }
        defaults.set(true, forKey: Keys.hotkeyMigration202602)

        self.hotkeyKeyCode = hasStoredKeyCode ? UInt32(defaults.integer(forKey: Keys.hotkeyKeyCode)) : UInt32(newDefaultKeyCode)
        self.hotkeyModifiers = hasStoredModifiers ? UInt32(defaults.integer(forKey: Keys.hotkeyModifiers)) : UInt32(newDefaultModifiers)

        if defaults.object(forKey: Keys.micAutoOn) == nil {
            defaults.set(true, forKey: Keys.micAutoOn)
        }
        self.micAutoOn = defaults.bool(forKey: Keys.micAutoOn)
        self.speechVoiceIdentifier = defaults.string(forKey: Keys.speechVoiceIdentifier) ?? ""

        self.commandSocketPath = defaults.string(forKey: Keys.commandSocketPath) ?? defaultCommandSocketPath
        self.windowSocketPath = defaults.string(forKey: Keys.windowSocketPath) ?? defaultWindowSocketPath

        let timeout = defaults.integer(forKey: Keys.timeoutSeconds)
        self.timeoutSeconds = timeout > 0 ? timeout : 30

        let history = defaults.integer(forKey: Keys.historyLimit)
        self.historyLimit = history > 0 ? history : 50

        self.runAtLogin = defaults.bool(forKey: Keys.runAtLogin)
        self.startupCommand = defaults.string(forKey: Keys.startupCommand) ?? ""
        self.startupCommandWorkingDirectory = defaults.string(forKey: Keys.startupCommandWorkingDirectory) ?? ""

        if defaults.object(forKey: Keys.closeOnOutsideClick) == nil {
            defaults.set(true, forKey: Keys.closeOnOutsideClick)
        }
        self.closeOnOutsideClick = defaults.bool(forKey: Keys.closeOnOutsideClick)
    }

    public static func defaultCommandSocketPath(appName: String = "LucaVoiceLauncher") -> String {
        guard let base = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            fatalError("Unable to resolve Application Support directory for command socket path")
        }
        let folder = base.appendingPathComponent(appName, isDirectory: true)
        return folder.appendingPathComponent("ipc-command.sock").path
    }

    public static func defaultWindowSocketPath(appName: String = "LucaVoiceLauncher") -> String {
        guard let base = FileManager.default.urls(
            for: .applicationSupportDirectory,
            in: .userDomainMask
        ).first else {
            fatalError("Unable to resolve Application Support directory for window socket path")
        }
        let folder = base.appendingPathComponent(appName, isDirectory: true)
        return folder.appendingPathComponent("ipc-window.sock").path
    }
}
