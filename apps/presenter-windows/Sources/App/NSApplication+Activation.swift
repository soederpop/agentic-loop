import AppKit

extension NSApplication {
    @MainActor
    func foregroundForManagedWindow() {
        if activationPolicy() != .regular {
            setActivationPolicy(.regular)
        }

        activate(ignoringOtherApps: true)
    }
}
