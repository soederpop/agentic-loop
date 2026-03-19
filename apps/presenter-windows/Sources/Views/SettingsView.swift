import SwiftUI

public struct SettingsView: View {
    @ObservedObject var settings: SettingsManager
    
    public init(settings: SettingsManager) {
        self.settings = settings
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                Toggle("Run at login (placeholder)", isOn: $settings.runAtLogin)

                VStack(alignment: .leading, spacing: 6) {
                    Text("Startup shell command (optional)")
                        .font(.caption)
                    TextField("/opt/homebrew/bin/bun /absolute/path/to/server.ts", text: $settings.startupCommand)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Startup working directory (optional)")
                        .font(.caption)
                    TextField("/absolute/path/to/project", text: $settings.startupCommandWorkingDirectory)
                        .textFieldStyle(.roundedBorder)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("Window socket path")
                        .font(.caption)
                    TextField("Window socket path", text: $settings.windowSocketPath)
                        .textFieldStyle(.roundedBorder)
                }

                Text("Window actions are accepted over the configured Unix socket. Hotkeys, voice input, and command dispatch are disabled in this mode.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding()
        }
        .frame(maxWidth: .infinity)
    }
}
