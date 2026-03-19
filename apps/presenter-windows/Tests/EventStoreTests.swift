import XCTest
@testable import LucaVoiceLauncher

@MainActor
final class EventStoreTests: XCTestCase {
    func testEventTransitions() async {
        let defaults = UserDefaults(suiteName: "EventStoreTests-\(UUID().uuidString)")!
        let settings = SettingsManager(defaults: defaults)
        settings.timeoutSeconds = 1
        settings.historyLimit = 10
        settings.commandSocketPath = "/tmp/luca-voice-launcher-tests-\(UUID().uuidString).sock"

        let store = EventStore(settings: settings)

        let event = store.createEvent(
            text: "open notes",
            transcript: "open notes",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )

        XCTAssertTrue(store.enqueue(event))
        XCTAssertEqual(store.active?.id, event.id)
        XCTAssertEqual(store.active?.event.status, .queued)

        store.markProcessing(id: event.id, worker: "bun-123")
        XCTAssertEqual(store.active?.event.status, .processing)

        store.markFinished(id: event.id, success: true, error: nil)
        XCTAssertNil(store.active)
        XCTAssertEqual(store.history.first(where: { $0.id == event.id })?.event.status, .finishedSuccess)
    }

    func testStallAfterTimeout() async {
        let defaults = UserDefaults(suiteName: "EventStoreStallTests-\(UUID().uuidString)")!
        let settings = SettingsManager(defaults: defaults)
        settings.timeoutSeconds = 1
        settings.commandSocketPath = "/tmp/luca-voice-launcher-tests-\(UUID().uuidString).sock"

        let store = EventStore(settings: settings)
        let event = store.createEvent(
            text: "stall me",
            transcript: "stall me",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )

        XCTAssertTrue(store.enqueue(event))
        try? await Task.sleep(nanoseconds: 1_300_000_000)
        XCTAssertEqual(store.active?.event.status, .stalled)

        store.cancelActive()
        XCTAssertNil(store.active)
        XCTAssertNil(store.history.first(where: { $0.id == event.id }))
    }

    func testRejectSecondActiveCommand() async {
        let defaults = UserDefaults(suiteName: "EventStoreSingleActiveTests-\(UUID().uuidString)")!
        let settings = SettingsManager(defaults: defaults)
        settings.commandSocketPath = "/tmp/luca-voice-launcher-tests-\(UUID().uuidString).sock"
        let store = EventStore(settings: settings)

        let first = store.createEvent(
            text: "first",
            transcript: "first",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )
        let second = store.createEvent(
            text: "second",
            transcript: "second",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )

        XCTAssertTrue(store.enqueue(first))
        XCTAssertFalse(store.enqueue(second))
        XCTAssertEqual(store.active?.id, first.id)
    }

    func testIgnoreLateFinishAfterCancel() async {
        let defaults = UserDefaults(suiteName: "EventStoreLateFinishTests-\(UUID().uuidString)")!
        let settings = SettingsManager(defaults: defaults)
        let store = EventStore(settings: settings)

        let event = store.createEvent(
            text: "run",
            transcript: "run",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )

        XCTAssertTrue(store.enqueue(event))
        store.cancelActive()
        XCTAssertNil(store.active)
        XCTAssertNil(store.history.first(where: { $0.id == event.id }))

        store.markFinished(id: event.id, success: true, error: nil)
        XCTAssertNil(store.history.first(where: { $0.id == event.id }))
    }

    func testDeleteActiveRemovesHistoryEntry() async {
        let defaults = UserDefaults(suiteName: "EventStoreDeleteActiveTests-\(UUID().uuidString)")!
        let settings = SettingsManager(defaults: defaults)
        let store = EventStore(settings: settings)

        let event = store.createEvent(
            text: "temp",
            transcript: "temp",
            source: .typed,
            hotkeyLabel: "Cmd+Space"
        )

        XCTAssertTrue(store.enqueue(event))
        store.deleteActive()
        XCTAssertNil(store.active)
        XCTAssertNil(store.history.first(where: { $0.id == event.id }))
    }
}
