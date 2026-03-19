import Foundation
import OSLog

public enum AppLogger {
    private static let subsystem = "com.soederpop.lucavoicelauncher"
    private static let logger = Logger(subsystem: subsystem, category: "app")
    private static let queue = DispatchQueue(label: "app.logger.file", qos: .utility)

    public static func info(_ message: String) {
        logger.info("\(message, privacy: .public)")
        appendToFile("INFO", message)
    }

    public static func error(_ message: String) {
        logger.error("\(message, privacy: .public)")
        appendToFile("ERROR", message)
    }

    private static func appendToFile(_ level: String, _ message: String) {
        queue.sync {
            let timestamp = ISO8601DateFormatter().string(from: Date())
            let line = "[\(timestamp)] [\(level)] \(message)\n"
            guard let data = line.data(using: .utf8) else { return }

            do {
                let url = logFileURL()
                if !FileManager.default.fileExists(atPath: url.path) {
                    FileManager.default.createFile(atPath: url.path, contents: nil)
                }

                let handle = try FileHandle(forWritingTo: url)
                defer { try? handle.close() }
                try handle.seekToEnd()
                try handle.write(contentsOf: data)
            } catch {
                logger.error("failed to write log file: \(error.localizedDescription, privacy: .public)")
            }
        }
    }

    public static func logFilePath() -> String {
        logFileURL().path
    }

    private static func logFileURL() -> URL {
        let root = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? URL(fileURLWithPath: NSTemporaryDirectory())
        let dir = root.appendingPathComponent("LucaVoiceLauncher", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("launcher.log")
    }
}
