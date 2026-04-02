import AppKit
import SwiftUI

@MainActor
public final class SettingsWindowController: NSWindowController {
    public init(appController: AppController) {
        let content = SettingsView(settings: appController.settings)
        let hosting = NSHostingView(rootView: content)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 560, height: 360),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: true
        )
        window.title = "Settings"
        window.center()
        window.isReleasedWhenClosed = false
        window.contentView = hosting

        super.init(window: window)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public func openWindow() {
        guard let window else { return }
        NSApp.foregroundForManagedWindow()
        window.makeKeyAndOrderFront(nil)
    }
}
