import Foundation

public enum CommandSource: String, Codable {
    case typed
    case voice
}

public enum EventStatus: String, Codable, CaseIterable {
    case created
    case queued
    case processing
    case finishedSuccess
    case finishedError
    case stalled
    case cleared

    public var isFinished: Bool {
        switch self {
        case .finishedSuccess, .finishedError, .cleared:
            return true
        default:
            return false
        }
    }
}

public struct CommandUser: Codable, Equatable {
    public let uid: Int32
    public let username: String

    public init(uid: Int32 = Int32(getuid()), username: String = NSUserName()) {
        self.uid = uid
        self.username = username
    }
}

public struct CommandPayload: Codable, Equatable {
    public var text: String
    public var transcript: String
    public var source: CommandSource
    public var user: CommandUser
    public var timestamp: String
    public var meta: [String: String]

    public init(
        text: String,
        transcript: String,
        source: CommandSource,
        user: CommandUser = CommandUser(),
        timestamp: String = ISO8601DateFormatter().string(from: Date()),
        meta: [String: String] = [:]
    ) {
        self.text = text
        self.transcript = transcript
        self.source = source
        self.user = user
        self.timestamp = timestamp
        self.meta = meta
    }
}

public struct CommandEvent: Codable, Identifiable, Equatable {
    public let id: UUID
    public var type: String
    public var payload: CommandPayload
    public var status: EventStatus

    public init(
        id: UUID = UUID(),
        type: String = "command",
        payload: CommandPayload,
        status: EventStatus = .created
    ) {
        self.id = id
        self.type = type
        self.payload = payload
        self.status = status
    }
}

public struct ServerMessage: Codable, Equatable {
    public let id: UUID
    public let status: String
    public let worker: String?
    public let pid: Int?
    public let timestamp: String?
    public let success: Bool?
    public let error: String?
    public let result: [String: JSONValue]?
    public let progress: Double?
    public let message: String?
    public let speech: String?
    public let speak: String?
    public let audioFile: String?
    public let window: WindowCommand?
    public let windowStateRefresh: Bool?

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // Tolerate missing or non-UUID id — generate a fallback so the message isn't lost
        if let raw = try container.decodeIfPresent(String.self, forKey: .id),
           let parsed = UUID(uuidString: raw) {
            id = parsed
        } else if let parsed = try? container.decode(UUID.self, forKey: .id) {
            id = parsed
        } else {
            id = UUID()
        }
        status = try container.decodeIfPresent(String.self, forKey: .status) ?? "unknown"
        worker = try container.decodeIfPresent(String.self, forKey: .worker)
        pid = try container.decodeIfPresent(Int.self, forKey: .pid)
        timestamp = try container.decodeIfPresent(String.self, forKey: .timestamp)
        success = try container.decodeIfPresent(Bool.self, forKey: .success)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        result = try container.decodeIfPresent([String: JSONValue].self, forKey: .result)
        progress = try container.decodeIfPresent(Double.self, forKey: .progress)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        speech = try container.decodeIfPresent(String.self, forKey: .speech)
        speak = try container.decodeIfPresent(String.self, forKey: .speak)
        audioFile = try container.decodeIfPresent(String.self, forKey: .audioFile)
        window = try container.decodeIfPresent(WindowCommand.self, forKey: .window)
        windowStateRefresh = try container.decodeIfPresent(Bool.self, forKey: .windowStateRefresh)
    }

    private enum CodingKeys: String, CodingKey {
        case id, status, worker, pid, timestamp, success, error, result
        case progress, message, speech, speak, audioFile, window, windowStateRefresh
    }
}

public enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
            return
        }
        if let value = try? container.decode(Bool.self) {
            self = .bool(value)
            return
        }
        if let value = try? container.decode(Double.self) {
            self = .number(value)
            return
        }
        if let value = try? container.decode(String.self) {
            self = .string(value)
            return
        }
        if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
            return
        }
        if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
            return
        }
        throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value")
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value):
            try container.encode(value)
        case .number(let value):
            try container.encode(value)
        case .bool(let value):
            try container.encode(value)
        case .object(let value):
            try container.encode(value)
        case .array(let value):
            try container.encode(value)
        case .null:
            try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self {
            return value
        }
        return nil
    }

    public static func from(any value: Any) -> JSONValue? {
        switch value {
        case is NSNull:
            return .null
        case let string as String:
            return .string(string)
        case let bool as Bool:
            return .bool(bool)
        case let number as NSNumber:
            if CFGetTypeID(number) == CFBooleanGetTypeID() {
                return .bool(number.boolValue)
            }
            return .number(number.doubleValue)
        case let dictionary as [String: Any]:
            var object: [String: JSONValue] = [:]
            for (key, nested) in dictionary {
                object[key] = from(any: nested) ?? .null
            }
            return .object(object)
        case let array as [Any]:
            return .array(array.map { from(any: $0) ?? .null })
        default:
            return nil
        }
    }
}

public struct WindowAckMessage: Encodable {
    public let id: UUID
    public let type: String
    public let status: String
    public let success: Bool
    public let action: String
    public let result: [String: JSONValue]?
    public let error: String?
    public let timestamp: String

    public init(
        id: UUID,
        success: Bool,
        action: String,
        result: [String: JSONValue]? = nil,
        error: String? = nil
    ) {
        self.id = id
        self.type = "windowAck"
        self.status = "finished"
        self.success = success
        self.action = action
        self.result = result
        self.error = error
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct WindowClosedMessage: Encodable {
    public let type: String
    public let windowId: String
    public let kind: String
    public let timestamp: String

    public init(windowId: UUID, kind: String) {
        self.type = "windowClosed"
        self.windowId = windowId.uuidString
        self.kind = kind
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct TerminalExitedMessage: Encodable {
    public let type: String
    public let windowId: String
    public let pid: Int?
    public let exitCode: Int
    public let timestamp: String

    public init(windowId: UUID, pid: Int?, exitCode: Int) {
        self.type = "terminalExited"
        self.windowId = windowId.uuidString
        self.pid = pid
        self.exitCode = exitCode
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct WindowFocusMessage: Encodable {
    public let type: String
    public let windowId: String
    public let kind: String
    public let focused: Bool
    public let frame: WindowFrame
    public let timestamp: String

    public init(windowId: UUID, kind: String, focused: Bool, frame: WindowFrame) {
        self.type = "windowFocus"
        self.windowId = windowId.uuidString
        self.kind = kind
        self.focused = focused
        self.frame = frame
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct HotkeyTriggerMessage: Encodable {
    public let type: String
    public let timestamp: String

    public init() {
        self.type = "hotkeyTrigger"
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct WindowStateSyncMessage: Encodable {
    public let type: String
    public let windows: [ManagedWindowState]
    public let timestamp: String

    public init(windows: [ManagedWindowState]) {
        self.type = "windowStateSync"
        self.windows = windows
        self.timestamp = ISO8601DateFormatter().string(from: Date())
    }
}

public struct ManagedWindowState: Encodable, Equatable {
    public let windowId: String
    public let kind: String
    public let title: String
    public let frame: WindowFrame
    public let focused: Bool
    public let url: String?
    public let command: String?
    public let pid: Int?

    public init(
        windowId: UUID,
        kind: String,
        title: String,
        frame: WindowFrame,
        focused: Bool,
        url: String? = nil,
        command: String? = nil,
        pid: Int? = nil
    ) {
        self.windowId = windowId.uuidString
        self.kind = kind
        self.title = title
        self.frame = frame
        self.focused = focused
        self.url = url
        self.command = command
        self.pid = pid
    }
}

public struct WindowFrame: Encodable, Equatable {
    public let x: Double
    public let y: Double
    public let width: Double
    public let height: Double

    public init(x: Double, y: Double, width: Double, height: Double) {
        self.x = x
        self.y = y
        self.width = width
        self.height = height
    }
}
