import AppKit
import SwiftUI

@MainActor
public final class LauncherPanelController: NSWindowController, NSWindowDelegate {
    public init(appController: AppController) {
        let content = MainView(controller: appController)
        let hosting = NSHostingView(rootView: content)
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 640, height: 380),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Luca Window Manager"
        window.isReleasedWhenClosed = false
        window.contentView = hosting
        window.center()

        super.init(window: window)
        window.delegate = self
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    public func openMainWindow() {
        guard let window else { return }
        NSApp.foregroundForManagedWindow()
        window.makeKeyAndOrderFront(nil)
    }

    public func windowWillClose(_ notification: Notification) {
        NSApp.terminate(nil)
    }
}
