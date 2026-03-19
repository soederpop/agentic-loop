import Foundation
import CoreGraphics

public struct SpawnWindowOptions: Codable, Equatable {
    public var decorations: String = "normal"
    public var transparent: Bool = false
    public var shadow: Bool = true
    public var alwaysOnTop: Bool = false
    public var opacity: Double = 1.0
    public var clickThrough: Bool = false

    public init(
        decorations: String = "normal",
        transparent: Bool = false,
        shadow: Bool = true,
        alwaysOnTop: Bool = false,
        opacity: Double = 1.0,
        clickThrough: Bool = false
    ) {
        self.decorations = decorations
        self.transparent = transparent
        self.shadow = shadow
        self.alwaysOnTop = alwaysOnTop
        self.opacity = opacity
        self.clickThrough = clickThrough
    }
}

public struct SpawnWindowRequest: Codable, Equatable {
    public var url: String?
    public var html: String?
    public var title: String?
    public var width: CGFloat = 900
    public var height: CGFloat = 700
    public var x: CGFloat?
    public var y: CGFloat?
    public var window: SpawnWindowOptions = .init()

    public init(
        url: String? = nil,
        html: String? = nil,
        title: String? = nil,
        width: CGFloat = 900,
        height: CGFloat = 700,
        x: CGFloat? = nil,
        y: CGFloat? = nil,
        window: SpawnWindowOptions = .init()
    ) {
        self.url = url
        self.html = html
        self.title = title
        self.width = width
        self.height = height
        self.x = x
        self.y = y
        self.window = window
    }
}

public struct WindowCommand: Codable, Equatable {
    public var action: String
    public var request: SpawnWindowRequest?
    public var windowId: String?
    public var path: String?
    public var code: String?
    public var timeoutMs: Int?
    public var returnJson: Bool?
    public var command: String?
    public var args: [String]?
    public var cwd: String?
    public var env: [String: String]?
    public var cols: Int?
    public var rows: Int?
    public var durationMs: Int?

    public init(
        action: String = "open",
        request: SpawnWindowRequest? = nil,
        windowId: String? = nil,
        path: String? = nil,
        code: String? = nil,
        timeoutMs: Int? = nil,
        returnJson: Bool? = nil,
        command: String? = nil,
        args: [String]? = nil,
        cwd: String? = nil,
        env: [String: String]? = nil,
        cols: Int? = nil,
        rows: Int? = nil,
        durationMs: Int? = nil
    ) {
        self.action = action
        self.request = request
        self.windowId = windowId
        self.path = path
        self.code = code
        self.timeoutMs = timeoutMs
        self.returnJson = returnJson
        self.command = command
        self.args = args
        self.cwd = cwd
        self.env = env
        self.cols = cols
        self.rows = rows
        self.durationMs = durationMs
    }

    enum CodingKeys: String, CodingKey {
        case action
        case request
        case windowId
        case path
        case url
        case html
        case title
        case width
        case height
        case x
        case y
        case window
        case windowOptions
        case decorations
        case transparent
        case shadow
        case alwaysOnTop
        case opacity
        case clickThrough
        case code
        case timeoutMs
        case returnJson
        case command
        case args
        case cwd
        case env
        case cols
        case rows
        case durationMs
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        action = try container.decodeIfPresent(String.self, forKey: .action) ?? "open"
        windowId = try container.decodeIfPresent(String.self, forKey: .windowId)
        path = try container.decodeIfPresent(String.self, forKey: .path)
        code = try container.decodeIfPresent(String.self, forKey: .code)
        timeoutMs = try container.decodeIfPresent(Int.self, forKey: .timeoutMs)
        returnJson = try container.decodeIfPresent(Bool.self, forKey: .returnJson)
        command = try container.decodeIfPresent(String.self, forKey: .command)
        args = try container.decodeIfPresent([String].self, forKey: .args)
        cwd = try container.decodeIfPresent(String.self, forKey: .cwd)
        env = try container.decodeIfPresent([String: String].self, forKey: .env)
        cols = try container.decodeIfPresent(Int.self, forKey: .cols)
        rows = try container.decodeIfPresent(Int.self, forKey: .rows)
        durationMs = try container.decodeIfPresent(Int.self, forKey: .durationMs)

        if let directRequest = try container.decodeIfPresent(SpawnWindowRequest.self, forKey: .request) {
            request = directRequest
            return
        }

        var hasOpenFields = false
        var parsedRequest = SpawnWindowRequest()

        if let url = try container.decodeIfPresent(String.self, forKey: .url) {
            parsedRequest.url = url
            hasOpenFields = true
        }
        if let html = try container.decodeIfPresent(String.self, forKey: .html) {
            parsedRequest.html = html
            hasOpenFields = true
        }
        if let title = try container.decodeIfPresent(String.self, forKey: .title) {
            parsedRequest.title = title
            hasOpenFields = true
        }
        if let width = try container.decodeIfPresent(CGFloat.self, forKey: .width) {
            parsedRequest.width = width
            hasOpenFields = true
        }
        if let height = try container.decodeIfPresent(CGFloat.self, forKey: .height) {
            parsedRequest.height = height
            hasOpenFields = true
        }
        if let x = try container.decodeIfPresent(CGFloat.self, forKey: .x) {
            parsedRequest.x = x
            hasOpenFields = true
        }
        if let y = try container.decodeIfPresent(CGFloat.self, forKey: .y) {
            parsedRequest.y = y
            hasOpenFields = true
        }

        var options = parsedRequest.window
        if let nestedWindow = try container.decodeIfPresent(SpawnWindowOptions.self, forKey: .window) {
            options = nestedWindow
            hasOpenFields = true
        }
        if let nestedWindowOptions = try container.decodeIfPresent(SpawnWindowOptions.self, forKey: .windowOptions) {
            options = nestedWindowOptions
            hasOpenFields = true
        }
        if let decorations = try container.decodeIfPresent(String.self, forKey: .decorations) {
            options.decorations = decorations
            hasOpenFields = true
        }
        if let transparent = try container.decodeIfPresent(Bool.self, forKey: .transparent) {
            options.transparent = transparent
            hasOpenFields = true
        }
        if let shadow = try container.decodeIfPresent(Bool.self, forKey: .shadow) {
            options.shadow = shadow
            hasOpenFields = true
        }
        if let alwaysOnTop = try container.decodeIfPresent(Bool.self, forKey: .alwaysOnTop) {
            options.alwaysOnTop = alwaysOnTop
            hasOpenFields = true
        }
        if let opacity = try container.decodeIfPresent(Double.self, forKey: .opacity) {
            options.opacity = opacity
            hasOpenFields = true
        }
        if let clickThrough = try container.decodeIfPresent(Bool.self, forKey: .clickThrough) {
            options.clickThrough = clickThrough
            hasOpenFields = true
        }
        parsedRequest.window = options

        request = hasOpenFields ? parsedRequest : nil
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(action, forKey: .action)
        try container.encodeIfPresent(windowId, forKey: .windowId)
        try container.encodeIfPresent(path, forKey: .path)
        try container.encodeIfPresent(code, forKey: .code)
        try container.encodeIfPresent(timeoutMs, forKey: .timeoutMs)
        try container.encodeIfPresent(returnJson, forKey: .returnJson)
        try container.encodeIfPresent(command, forKey: .command)
        try container.encodeIfPresent(args, forKey: .args)
        try container.encodeIfPresent(cwd, forKey: .cwd)
        try container.encodeIfPresent(env, forKey: .env)
        try container.encodeIfPresent(cols, forKey: .cols)
        try container.encodeIfPresent(rows, forKey: .rows)
        try container.encodeIfPresent(durationMs, forKey: .durationMs)
        try container.encodeIfPresent(request, forKey: .request)
    }
}
