import SwiftUI

@main
struct LucaVoiceLauncherMainApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) var appDelegate

    var body: some Scene {
        Settings {
            SettingsView(settings: SettingsManager.shared)
        }
    }
}
