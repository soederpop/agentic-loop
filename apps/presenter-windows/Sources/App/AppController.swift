import Foundation
import SwiftUI
import Combine

@MainActor
public final class AppController: ObservableObject {
    @Published public var isConnected = false
    @Published public var latestError: String?
    @Published public var lastEventDescription: String?

    public let settings: SettingsManager
    private let windowIPCClient: IPCClient
    private let windowManager: BrowserWindowManager
    private var cancellables = Set<AnyCancellable>()
    private var heartbeatTask: Task<Void, Never>?

    public init(
        settings: SettingsManager,
        windowIPCClient: IPCClient,
        windowManager: BrowserWindowManager
    ) {
        self.settings = settings
        self.windowIPCClient = windowIPCClient
        self.windowManager = windowManager
        self.windowIPCClient.delegate = self
        self.windowManager.onWindowLifecycleEvent = { [weak self] event in
            guard let self else { return }
            switch event.type {
            case .windowClosed:
                self.windowIPCClient.sendWindowClosed(
                    WindowClosedMessage(windowId: event.windowId, kind: event.kind.rawValue)
                )
            case .terminalExited:
                self.windowIPCClient.sendTerminalExited(
                    TerminalExitedMessage(
                        windowId: event.windowId,
                        pid: event.pid,
                        exitCode: event.exitCode ?? 0
                    )
                )
            }
        }
        wireSettings()
    }

    public func start() {
        windowIPCClient.connect()
        AppLogger.info("window IPC client start requested")
        startHeartbeat()
    }

    deinit {
        heartbeatTask?.cancel()
    }

    public func handleApplicationActivated() {
        windowManager.bringManagedWindowsToFront()
    }

    private func wireSettings() {
        settings.$windowSocketPath
            .dropFirst()
            .sink { [weak self] path in
                self?.windowIPCClient.updateSocketPath(path)
            }
            .store(in: &cancellables)
    }

    private func startHeartbeat() {
        heartbeatTask?.cancel()
        heartbeatTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                guard let self, !Task.isCancelled else { continue }
                AppLogger.info("heartbeat alive connected=\(self.isConnected) socketPath=\(self.settings.windowSocketPath)")
            }
        }
    }
}

extension AppController: IPCClientDelegate {
    public func ipcClientDidConnect(_ client: IPCClient) {
        isConnected = true
        latestError = nil
        AppLogger.info("ipc window delegate: connected")
    }

    public func ipcClientDidDisconnect(_ client: IPCClient) {
        isConnected = false
        AppLogger.info("ipc window delegate: disconnected")
    }

    public func ipcClient(_ client: IPCClient, didReceive message: ServerMessage) {
        guard client === windowIPCClient else { return }
        if let windowCommand = message.window {
            AppLogger.info("received window command action=\(windowCommand.action)")
            windowManager.handle(windowCommand) { [weak self] result in
                guard let self else { return }
                switch result {
                case .success(let payload):
                    self.lastEventDescription = "Handled window action '\(windowCommand.action)' (\(message.id.uuidString))"
                    client.sendWindowAck(
                        WindowAckMessage(
                            id: message.id,
                            success: true,
                            action: windowCommand.action,
                            result: payload
                        )
                    )
                case .failure(let errorMessage):
                    self.latestError = "Window command failed: \(errorMessage.localizedDescription)"
                    self.lastEventDescription = "Failed window action '\(windowCommand.action)' (\(message.id.uuidString))"
                    AppLogger.error("window command failed action=\(windowCommand.action) error=\(errorMessage.localizedDescription)")
                    client.sendWindowAck(
                        WindowAckMessage(
                            id: message.id,
                            success: false,
                            action: windowCommand.action,
                            error: errorMessage.localizedDescription
                        )
                    )
                }
            }
        } else {
            lastEventDescription = "Ignored non-window message \(message.id.uuidString)"
        }
    }
}
