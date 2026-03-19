import Foundation

public enum SocketHelpers {
    public static func ensureParentDirectoryExists(for socketPath: String) {
        let url = URL(fileURLWithPath: socketPath)
        let dir = url.deletingLastPathComponent()
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    }
}
