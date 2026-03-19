import Foundation
import Carbon

public final class HotkeyManager {
    public static let shared = HotkeyManager()

    private var hotKeyRef: EventHotKeyRef?
    private var eventHandler: EventHandlerRef?
    private var onTrigger: (() -> Void)?

    private init() {}

    deinit {
        unregister()
    }

    public func register(keyCode: UInt32, modifiers: UInt32, onTrigger: @escaping () -> Void) {
        unregister()
        self.onTrigger = onTrigger

        let hotKeyID = EventHotKeyID(signature: OSType(0x4C43484B), id: UInt32(1))
        let status = RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )

        guard status == noErr else {
            AppLogger.error("RegisterEventHotKey failed: \(status)")
            return
        }
        AppLogger.info("hotkey registered keyCode=\(keyCode) modifiers=\(modifiers)")

        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))

        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, _, userData in
                guard let userData else { return noErr }
                let manager = Unmanaged<HotkeyManager>.fromOpaque(userData).takeUnretainedValue()
                manager.onTrigger?()
                return noErr
            },
            1,
            &eventType,
            UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
            &eventHandler
        )
    }

    public func unregister() {
        if let hotKeyRef {
            UnregisterEventHotKey(hotKeyRef)
        }
        if let eventHandler {
            RemoveEventHandler(eventHandler)
        }
        hotKeyRef = nil
        eventHandler = nil
        AppLogger.info("hotkey unregistered")
    }
}
