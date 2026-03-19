import Foundation
import Combine

@MainActor
public final class EventStore: ObservableObject {
    public struct HistoryEntry: Codable, Identifiable, Equatable {
        public var id: UUID { event.id }
        public var event: CommandEvent
        public var updatedAt: Date
        public var worker: String?
        public var errorMessage: String?

        public init(event: CommandEvent, updatedAt: Date = Date(), worker: String? = nil, errorMessage: String? = nil) {
            self.event = event
            self.updatedAt = updatedAt
            self.worker = worker
            self.errorMessage = errorMessage
        }
    }

    @Published public private(set) var active: HistoryEntry?
    @Published public private(set) var history: [HistoryEntry] = []
    @Published public private(set) var offline = false

    private let settings: SettingsManager
    private var stallTask: Task<Void, Never>?

    public init(settings: SettingsManager) {
        self.settings = settings
    }

    public func createEvent(text: String, transcript: String, source: CommandSource, hotkeyLabel: String) -> CommandEvent {
        let payload = CommandPayload(
            text: text,
            transcript: transcript,
            source: source,
            meta: ["hotkey": hotkeyLabel]
        )
        return CommandEvent(payload: payload)
    }

    @discardableResult
    public func enqueue(_ event: CommandEvent) -> Bool {
        guard active == nil else { return false }

        var queued = event
        queued.status = .queued
        let entry = HistoryEntry(event: queued, updatedAt: Date())
        active = entry
        upsertHistory(entry)
        scheduleStallTimer(for: entry.id)
        return true
    }

    public func markProcessing(id: UUID, worker: String?) {
        guard var entry = active, entry.id == id else { return }
        entry.event.status = .processing
        entry.worker = worker
        entry.updatedAt = Date()
        active = entry
        upsertHistory(entry)
    }

    public func markFinished(id: UUID, success: Bool, error: String?) {
        guard var entry = active, entry.id == id else { return }
        entry.event.status = success ? .finishedSuccess : .finishedError
        entry.updatedAt = Date()
        entry.errorMessage = error
        upsertHistory(entry)
        active = nil
        stallTask?.cancel()
        stallTask = nil
    }

    public func markStalled(id: UUID) {
        guard var entry = active, entry.id == id else { return }
        guard !entry.event.status.isFinished else { return }
        entry.event.status = .stalled
        entry.updatedAt = Date()
        active = entry
        upsertHistory(entry)
    }

    public func abortActive() {
        deleteActive()
    }

    public func cancelActive() {
        deleteActive()
    }

    public func deleteActive() {
        guard let current = active else { return }
        active = nil
        stallTask?.cancel()
        stallTask = nil
        history.removeAll { $0.id == current.id }
    }

    public func deleteHistory(id: UUID) {
        if active?.id == id {
            active = nil
            stallTask?.cancel()
            stallTask = nil
        }
        history.removeAll { $0.id == id }
    }

    public func setOffline(_ value: Bool) {
        offline = value
    }

    public func resubmit(_ entry: HistoryEntry) -> CommandEvent {
        let payload = entry.event.payload
        return CommandEvent(payload: payload)
    }

    private func scheduleStallTimer(for id: UUID) {
        stallTask?.cancel()
        let timeout = settings.timeoutSeconds
        stallTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(timeout) * 1_000_000_000)
            await MainActor.run {
                self?.markStalled(id: id)
            }
        }
    }

    private func upsertHistory(_ entry: HistoryEntry) {
        if let index = history.firstIndex(where: { $0.id == entry.id }) {
            history[index] = entry
        } else {
            history.insert(entry, at: 0)
        }
        if history.count > settings.historyLimit {
            history = Array(history.prefix(settings.historyLimit))
        }
    }
}
