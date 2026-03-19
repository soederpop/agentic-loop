import SwiftUI

public struct HistoryView: View {
    public let entries: [EventStore.HistoryEntry]
    public let canRun: Bool
    public let resubmit: (EventStore.HistoryEntry) -> Void
    public let deleteEntry: (EventStore.HistoryEntry) -> Void

    public init(
        entries: [EventStore.HistoryEntry],
        canRun: Bool,
        resubmit: @escaping (EventStore.HistoryEntry) -> Void,
        deleteEntry: @escaping (EventStore.HistoryEntry) -> Void
    ) {
        self.entries = entries
        self.canRun = canRun
        self.resubmit = resubmit
        self.deleteEntry = deleteEntry
    }

    public var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("History")
                .font(.caption)
                .foregroundStyle(.secondary)

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    if entries.isEmpty {
                        Text("No command history yet.")
                            .font(.caption)
                            .foregroundStyle(.white.opacity(0.72))
                            .padding(.vertical, 6)
                    }

                    ForEach(entries) { entry in
                        HStack(alignment: .top) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(entry.event.payload.text)
                                    .font(.callout)
                                    .foregroundStyle(.white)
                                    .lineLimit(3)
                                Text(entry.updatedAt.formatted(date: .omitted, time: .shortened))
                                    .font(.caption)
                                    .foregroundStyle(.white.opacity(0.72))
                            }

                            Spacer(minLength: 8)

                            Text(entry.event.status.rawValue)
                                .font(.caption2.monospaced())
                                .foregroundStyle(statusColor(entry.event.status))

                            Button("Run") {
                                resubmit(entry)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                            .disabled(!canRun)

                            Button("Delete") {
                                deleteEntry(entry)
                            }
                            .buttonStyle(.bordered)
                            .controlSize(.mini)
                        }
                        .padding(.vertical, 6)
                        .padding(.horizontal, 8)
                        .background(Color.white.opacity(0.10), in: RoundedRectangle(cornerRadius: 8))
                    }
                }
                .padding(.vertical, 4)
            }
        }
        .padding(10)
        .frame(maxHeight: 260)
        .background(Color.white.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
    }

    private func statusColor(_ status: EventStatus) -> Color {
        switch status {
        case .finishedSuccess: return .green
        case .finishedError, .stalled: return .red
        case .processing: return .yellow
        default: return .secondary
        }
    }
}
