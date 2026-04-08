import Foundation
import Combine

@MainActor
public protocol IPCClientDelegate: AnyObject {
    func ipcClientDidConnect(_ client: IPCClient)
    func ipcClientDidDisconnect(_ client: IPCClient)
    func ipcClient(_ client: IPCClient, didReceive message: ServerMessage)
}

public final class IPCClient {
    public weak var delegate: IPCClientDelegate?

    private let queue = DispatchQueue(label: "ipc.client.queue", qos: .userInitiated)
    private var socketFD: Int32 = -1
    private var readSource: DispatchSourceRead?
    private var reconnectTask: DispatchWorkItem?
    private var backoffSeconds: TimeInterval = 0.25
    private var buffer = Data()
    private let initialBackoff: TimeInterval = 0.25
    private let backoffMultiplier: TimeInterval = 1.6
    private let maxBackoff: TimeInterval = 5

    public private(set) var socketPath: String
    public private(set) var isConnected = false

    public init(socketPath: String) {
        self.socketPath = socketPath
    }

    deinit {
        disconnect()
    }

    public func updateSocketPath(_ path: String) {
        queue.async { [weak self] in
            guard let self else { return }
            self.socketPath = path
            self.disconnectLocked()
            self.connectLocked()
        }
    }

    public func connect() {
        queue.async { [weak self] in
            AppLogger.info("ipc connect requested path=\(self?.socketPath ?? "")")
            self?.connectLocked()
        }
    }

    public func disconnect() {
        queue.async { [weak self] in
            self?.disconnectLocked()
        }
    }

    public func send(event: CommandEvent) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(event, logContext: "event")
        }
    }

    public func sendWindowAck(_ ack: WindowAckMessage) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(ack, logContext: "windowAck")
        }
    }

    public func sendWindowClosed(_ event: WindowClosedMessage) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(event, logContext: "windowClosed")
        }
    }

    public func sendTerminalExited(_ event: TerminalExitedMessage) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(event, logContext: "terminalExited")
        }
    }

    public func sendWindowFocus(_ event: WindowFocusMessage) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(event, logContext: "windowFocus")
        }
    }

    public func sendHotkeyTrigger() {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(HotkeyTriggerMessage(), logContext: "hotkeyTrigger")
        }
    }

    public func sendWindowStateSync(_ event: WindowStateSyncMessage) {
        queue.async { [weak self] in
            guard let self else { return }
            guard self.isConnected, self.socketFD >= 0 else {
                self.scheduleReconnectLocked()
                return
            }
            self.sendEncodedLocked(event, logContext: "windowStateSync")
        }
    }

    private func connectLocked() {
        guard !isConnected else { return }

        // Clear any leftover data from a previous connection
        buffer.removeAll(keepingCapacity: true)

        socketFD = socket(AF_UNIX, SOCK_STREAM, 0)
        guard socketFD >= 0 else {
            AppLogger.error("ipc socket creation failed")
            scheduleReconnectLocked()
            return
        }

        var addr = sockaddr_un()
        addr.sun_family = sa_family_t(AF_UNIX)
        let maxLen = MemoryLayout.size(ofValue: addr.sun_path)

        guard socketPath.utf8.count < maxLen else {
            AppLogger.error("ipc socket path too long")
            disconnectLocked()
            return
        }

        withUnsafeMutablePointer(to: &addr.sun_path) { ptr in
            ptr.withMemoryRebound(to: CChar.self, capacity: maxLen) { rebounded in
                _ = socketPath.withCString { src in
                    strncpy(rebounded, src, maxLen - 1)
                }
            }
        }

        let addrLen = socklen_t(MemoryLayout<sa_family_t>.size + socketPath.utf8.count + 1)
        let result = withUnsafePointer(to: &addr) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                Darwin.connect(socketFD, $0, addrLen)
            }
        }

        guard result == 0 else {
            AppLogger.error("ipc connect failed path=\(socketPath)")
            disconnectLocked()
            scheduleReconnectLocked()
            return
        }

        isConnected = true
        backoffSeconds = initialBackoff
        setupReaderLocked()
        AppLogger.info("ipc connected path=\(socketPath)")
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            self.delegate?.ipcClientDidConnect(self)
        }
    }

    private func disconnectLocked() {
        readSource?.cancel()
        readSource = nil

        if socketFD >= 0 {
            close(socketFD)
            socketFD = -1
        }

        if isConnected {
            isConnected = false
            AppLogger.info("ipc disconnected")
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                self.delegate?.ipcClientDidDisconnect(self)
            }
        }
    }

    private func setupReaderLocked() {
        let source = DispatchSource.makeReadSource(fileDescriptor: socketFD, queue: queue)
        source.setEventHandler { [weak self] in
            self?.readAvailableLocked()
        }
        source.setCancelHandler { [weak self] in
            guard let self else { return }
            self.buffer.removeAll(keepingCapacity: false)
        }
        readSource = source
        source.resume()
    }

    private func readAvailableLocked() {
        var temp = [UInt8](repeating: 0, count: 8192)
        let bytesRead = read(socketFD, &temp, temp.count)

        if bytesRead <= 0 {
            disconnectLocked()
            scheduleReconnectLocked()
            return
        }

        buffer.append(temp, count: bytesRead)
        processBufferLocked()
    }

    private func processBufferLocked() {
        while let newline = buffer.firstIndex(of: 0x0A) {
            let line = buffer.prefix(upTo: newline)
            buffer.removeSubrange(...newline)
            guard !line.isEmpty else { continue }

            do {
                let message = try JSONDecoder().decode(ServerMessage.self, from: Data(line))
                DispatchQueue.main.async { [weak self] in
                    guard let self else { return }
                    self.delegate?.ipcClient(self, didReceive: message)
                }
            } catch {
                let preview = String(data: Data(line.prefix(200)), encoding: .utf8) ?? "<non-utf8>"
                AppLogger.error("ipc decode failed: \(error) raw=\(preview)")
            }
        }
    }

    private func scheduleReconnectLocked() {
        reconnectTask?.cancel()
        let delay = backoffSeconds
        backoffSeconds = min(backoffSeconds * backoffMultiplier, maxBackoff)
        AppLogger.info("ipc reconnect scheduled in \(delay)s")

        let task = DispatchWorkItem { [weak self] in
            self?.connectLocked()
        }
        reconnectTask = task
        queue.asyncAfter(deadline: .now() + delay, execute: task)
    }

    public func parseLineForTest(_ line: String) -> ServerMessage? {
        do {
            return try JSONDecoder().decode(ServerMessage.self, from: Data(line.utf8))
        } catch {
            return nil
        }
    }

    private func writePacketLocked(_ payload: Data) {
        var packet = payload
        packet.append(0x0A)
        let bytes = [UInt8](packet)
        let result = write(socketFD, bytes, bytes.count)
        if result < 0 {
            AppLogger.error("ipc write failed")
            disconnectLocked()
            scheduleReconnectLocked()
        }
    }

    private func sendEncodedLocked<T: Encodable>(_ payload: T, logContext: String) {
        do {
            let data = try JSONEncoder().encode(payload)
            writePacketLocked(data)
        } catch {
            AppLogger.error("ipc encode \(logContext) failed: \(error.localizedDescription)")
        }
    }
}
