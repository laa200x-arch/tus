import SwiftUI

/// 首页（职场关系操作系统 v2）
/// 旧首页实现已被重构后的 HomeOverviewView 取代，本类型保留为兼容入口：
/// 仅转发到新首页，避免删除仍被引用的共享视图（MoodCheckinView 等）。
struct StatusHomeView: View {
    var body: some View {
        HomeOverviewView()
    }
}

/// 完整情绪打卡（情绪 + 压力源 + 备注）
struct MoodCheckinView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var mood: String = ""
    @State private var stressSources: Set<String> = []
    @State private var note = ""
    @State private var submitting = false

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    moodSection
                    stressSection
                    noteSection
                    submitButton
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("情绪打卡")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            .onAppear {
                if let today = store.moodToday {
                    mood = today.mood ?? mood
                    stressSources = Set(today.stressSources ?? [])
                    note = today.note ?? ""
                }
            }
        }
    }

    private var moodSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("今日情绪（必选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 72), spacing: 8)], spacing: 8) {
                ForEach(MoodCheckinSelection.items) { m in
                    let active = LittleEnergyCatalog.normalizeMood(mood) == m.id
                    Button {
                        mood = m.id
                    } label: {
                        LittleEnergyMoodTile(mood: m, selected: active, size: 42)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(active ? Theme.primary : Theme.cardBg))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: active ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var stressSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("压力来源（多选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 8)], spacing: 8) {
                ForEach(store.tagDict.stressSources) { s in
                    let active = stressSources.contains(s.id)
                    Button {
                        if active { stressSources.remove(s.id) }
                        else { stressSources.insert(s.id) }
                    } label: {
                        Text(s.label)
                            .font(.caption2)
                            .foregroundStyle(active ? .white : Theme.textPrimary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(active ? Theme.primary : Theme.cardBg))
                            .overlay(Capsule().stroke(Theme.divider, lineWidth: active ? 0 : 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    private var noteSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("备注（可选，最多 500 字）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            TextField("今天发生了什么…", text: $note, axis: .vertical)
                .lineLimit(3...5)
                .padding(10)
                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.divider, lineWidth: 1))
        }
    }

    private var submitButton: some View {
        Button {
            submit()
        } label: {
            Text(submitting ? "提交中…" : "打卡")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(mood.isEmpty ? Theme.primary.opacity(0.4) : Theme.primary))
        }
        .disabled(mood.isEmpty || submitting)
    }

    private func submit() {
        guard !mood.isEmpty else { return }
        submitting = true
        Task {
            let ok = await store.checkinMood(
                mood: mood,
                stressSources: Array(stressSources),
                note: String(note.prefix(500))
            )
            submitting = false
            if ok { dismiss() }
        }
    }
}

#Preview {
    NavigationStack {
        StatusHomeView()
            .environmentObject(MockDataStore.shared)
    }
}
