import XCTest
@testable import LucaVoiceLauncher

final class IPCClientTests: XCTestCase {
    func testParseValidServerMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = "{\"id\":\"\(id.uuidString)\",\"status\":\"processing\",\"worker\":\"bun-1\"}"

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.id, id)
        XCTAssertEqual(parsed?.status, "processing")
        XCTAssertEqual(parsed?.worker, "bun-1")
    }

    func testParseInvalidServerMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let parsed = client.parseLineForTest("{invalid-json")
        XCTAssertNil(parsed)
    }

    func testParseWindowCommandMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = """
        {"id":"\(id.uuidString)","status":"processing","window":{"action":"open","url":"https://example.com","width":1024,"height":768,"alwaysOnTop":true}}
        """

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.window?.action, "open")
        XCTAssertEqual(parsed?.window?.request?.url, "https://example.com")
        XCTAssertEqual(parsed?.window?.request?.width, 1024)
        XCTAssertEqual(parsed?.window?.request?.height, 768)
        XCTAssertEqual(parsed?.window?.request?.window.alwaysOnTop, true)
    }

    func testParseEvalWindowCommandMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = """
        {"id":"\(id.uuidString)","status":"processing","window":{"action":"eval","windowId":"74D5A3C6-26D0-4E60-84AA-17E0AC46D219","code":"document.title","timeoutMs":2500,"returnJson":false}}
        """

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.window?.action, "eval")
        XCTAssertEqual(parsed?.window?.windowId, "74D5A3C6-26D0-4E60-84AA-17E0AC46D219")
        XCTAssertEqual(parsed?.window?.code, "document.title")
        XCTAssertEqual(parsed?.window?.timeoutMs, 2500)
        XCTAssertEqual(parsed?.window?.returnJson, false)
    }

    func testParseTerminalWindowCommandMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = """
        {"id":"\(id.uuidString)","status":"processing","window":{"action":"terminal","title":"Build Logs","command":"swift","args":["test","--parallel"],"cwd":"~/projects/command-launcher","env":{"TERM":"xterm-256color"},"cols":160,"rows":50}}
        """

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.window?.action, "terminal")
        XCTAssertEqual(parsed?.window?.request?.title, "Build Logs")
        XCTAssertEqual(parsed?.window?.command, "swift")
        XCTAssertEqual(parsed?.window?.args ?? [], ["test", "--parallel"])
        XCTAssertEqual(parsed?.window?.cwd, "~/projects/command-launcher")
        XCTAssertEqual(parsed?.window?.env?["TERM"], "xterm-256color")
        XCTAssertEqual(parsed?.window?.cols, 160)
        XCTAssertEqual(parsed?.window?.rows, 50)
    }

    func testParseScreenGrabWindowCommandMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = """
        {"id":"\(id.uuidString)","status":"processing","window":{"action":"screengrab","windowId":"74D5A3C6-26D0-4E60-84AA-17E0AC46D219","path":"~/Desktop/window.png"}}
        """

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.window?.action, "screengrab")
        XCTAssertEqual(parsed?.window?.windowId, "74D5A3C6-26D0-4E60-84AA-17E0AC46D219")
        XCTAssertEqual(parsed?.window?.path, "~/Desktop/window.png")
    }

    func testParseVideoWindowCommandMessage() {
        let client = IPCClient(socketPath: "/tmp/test.sock")
        let id = UUID()
        let line = """
        {"id":"\(id.uuidString)","status":"processing","window":{"action":"video","path":"~/Desktop/window.mov","durationMs":2500}}
        """

        let parsed = client.parseLineForTest(line)
        XCTAssertNotNil(parsed)
        XCTAssertEqual(parsed?.window?.action, "video")
        XCTAssertEqual(parsed?.window?.path, "~/Desktop/window.mov")
        XCTAssertEqual(parsed?.window?.durationMs, 2500)
    }
}
