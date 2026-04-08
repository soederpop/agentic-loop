import Foundation
import Carbon

public final class HotkeyManager {
    public static let shared = HotkeyManager()

    private struct Registration {
        var hotKeyRef: EventHotKeyRef?
        var onTrigger: () -> Void
    }

    private var registrations: [UInt32: Registration] = [:]
    private var eventHandler: EventHandlerRef?
    private var nextSignature: UInt32 = 0x4C43_4801 // "LCH\x01" — increments per registration

    private init() {}

    deinit {
        unregisterAll()
    }

    /// Register a global hotkey. `id` is a caller-chosen key for later unregistration.
    public func register(id: UInt32, keyCode: UInt32, modifiers: UInt32, onTrigger: @escaping () -> Void) {
        // Unregister previous registration with the same id if any
        if let existing = registrations[id], let ref = existing.hotKeyRef {
            UnregisterEventHotKey(ref)
        }

        let signature = nextSignature
        nextSignature += 1

        let hotKeyID = EventHotKeyID(signature: signature, id: id)
        var hotKeyRef: EventHotKeyRef?
        let status = RegisterEventHotKey(
            keyCode,
            modifiers,
            hotKeyID,
            GetApplicationEventTarget(),
            0,
            &hotKeyRef
        )

        guard status == noErr else {
            AppLogger.error("RegisterEventHotKey failed: \(status) id=\(id)")
            return
        }

        registrations[id] = Registration(hotKeyRef: hotKeyRef, onTrigger: onTrigger)
        AppLogger.info("hotkey registered id=\(id) keyCode=\(keyCode) modifiers=\(modifiers)")

        // Install the shared event handler once
        if eventHandler == nil {
            installEventHandler()
        }
    }

    public func unregister(id: UInt32) {
        guard let reg = registrations.removeValue(forKey: id) else { return }
        if let ref = reg.hotKeyRef {
            UnregisterEventHotKey(ref)
        }
        AppLogger.info("hotkey unregistered id=\(id)")

        if registrations.isEmpty {
            removeEventHandler()
        }
    }

    public func unregisterAll() {
        for (_, reg) in registrations {
            if let ref = reg.hotKeyRef {
                UnregisterEventHotKey(ref)
            }
        }
        registrations.removeAll()
        removeEventHandler()
        AppLogger.info("all hotkeys unregistered")
    }

    // Legacy single-hotkey API — registers with id 0
    public func register(keyCode: UInt32, modifiers: UInt32, onTrigger: @escaping () -> Void) {
        register(id: 0, keyCode: keyCode, modifiers: modifiers, onTrigger: onTrigger)
    }

    public func unregister() {
        unregisterAll()
    }

    private func installEventHandler() {
        var eventType = EventTypeSpec(eventClass: OSType(kEventClassKeyboard), eventKind: UInt32(kEventHotKeyPressed))

        InstallEventHandler(
            GetApplicationEventTarget(),
            { _, event, userData in
                guard let event, let userData else { return noErr }
                let manager = Unmanaged<HotkeyManager>.fromOpaque(userData).takeUnretainedValue()

                var hotKeyID = EventHotKeyID()
                let status = GetEventParameter(
                    event,
                    EventParamName(kEventParamDirectObject),
                    EventParamType(typeEventHotKeyID),
                    nil,
                    MemoryLayout<EventHotKeyID>.size,
                    nil,
                    &hotKeyID
                )
                guard status == noErr else { return noErr }

                if let reg = manager.registrations[hotKeyID.id] {
                    reg.onTrigger()
                }

                return noErr
            },
            1,
            &eventType,
            UnsafeMutableRawPointer(Unmanaged.passUnretained(self).toOpaque()),
            &eventHandler
        )
    }

    private func removeEventHandler() {
        if let handler = eventHandler {
            RemoveEventHandler(handler)
            eventHandler = nil
        }
    }
}
