import SwiftUI

public struct MainView: View {
    @ObservedObject var controller: AppController

    public init(controller: AppController) {
        self.controller = controller
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Luca Window Manager")
                .font(.title2)
                .fontWeight(.semibold)

            Label(
                controller.isConnected ? "Connected to window socket" : "Waiting for window socket connection",
                systemImage: controller.isConnected ? "checkmark.circle.fill" : "bolt.horizontal.circle"
            )
            .foregroundStyle(controller.isConnected ? .green : .orange)

            VStack(alignment: .leading, spacing: 6) {
                Text("Window socket path")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Text(controller.settings.windowSocketPath)
                    .font(.system(.body, design: .monospaced))
                    .textSelection(.enabled)
            }

            if let event = controller.lastEventDescription {
                Text(event)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            if let error = controller.latestError {
                Text(error)
                    .font(.callout)
                    .foregroundStyle(.red)
            }

            Spacer()
        }
        .padding(20)
        .frame(minWidth: 600, minHeight: 320)
    }
}
