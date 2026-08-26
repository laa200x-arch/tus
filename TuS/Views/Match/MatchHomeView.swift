import SwiftUI

/// 首页（职场关系操作系统 v2）
/// 问候 + 4 数据卡 + 今日情绪打卡 + 最新吐槽摘要 + AI 洞察入口
struct StatusHomeView: View {
    @EnvironmentObject private var store: MockDataStore
    @State private var showCheckin = false
    @State private var showCompose = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                greetingCard
                statGrid
                moodCard
                latestSection
                aiEntryCard
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.bg)
        .navigationTitle("首页")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            if store.isServerMode {
                try? await store.refreshAll()
            }
        }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showCompose = true
                } label: {
                    Image(systemName: "square.and.pencil")
                }
            }
        }
        .sheet(isPresented: $showCompose) {
            ComplaintComposeView()
        }
        .sheet(isPresented: $showCheckin) {
            MoodCheckinView()
        }
        .task {
            if store.isServerMode {
                await store.refreshMood()
                await store.loadPersonality()
            }
        }
    }

    // MARK: - 问候

    private var greeting: String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<9: return "早上好"
        case 9..<12: return "上午好"
        case 12..<14: return "中午好"
        case 14..<18: return "下午好"
        default: return "晚上好"
        }
    }

    private var greetingCard: some View {
        HStack(spacing: 12) {
            LittleEnergyAvatarView(
                moodID: store.currentMoodID,
                outfit: store.currentUser.littleEnergyOutfit,
                size: 82
            )
            VStack(alignment: .leading, spacing: 6) {
                Text("\(greeting)，\(store.currentUser.userName)")
                    .font(.title2)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Text("今天也要好好上班（和好好吐槽）")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            Spacer()
        }
        .padding(.top, 4)
    }

    // MARK: - 数据卡

    private var statGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 10) {
            statCard(icon: "heart.text.square", title: "今日打卡",
                     value: store.moodCheckedToday ? "已打卡" : "未打卡",
                     tint: store.moodCheckedToday ? Theme.success : Theme.warning)
            statCard(icon: "flame", title: "广场吐槽",
                     value: "\(store.feedComplaints.count) 条", tint: Theme.secondary)
            statCard(icon: "text.bubble", title: "我的吐槽",
                     value: "\(store.myComplaints.count) 条", tint: Theme.primary)
            statCard(icon: "person.2", title: "同事档案",
                     value: "\(store.colleagues.count) 人", tint: Theme.primaryDeep)
        }
    }

    private func statCard(icon: String, title: String, value: String, tint: Color) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(Circle().fill(tint.opacity(0.12)))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                Text(value)
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
            }
            Spacer(minLength: 0)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - 今日打卡

    private var moodCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Label("今日情绪打卡", systemImage: "heart.text.square")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                if store.moodCheckedToday {
                    Button("修改") { showCheckin = true }
                        .font(.caption)
                        .foregroundStyle(Theme.primary)
                }
            }
            if store.moodCheckedToday, let checkin = store.moodToday {
                HStack(spacing: 12) {
                    LittleEnergyAvatarView(
                        moodID: LittleEnergyCatalog.normalizeMood(checkin.mood),
                        outfit: store.currentUser.littleEnergyOutfit,
                        size: 58
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        Text("今天已记录心情")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textPrimary)
                        if let sources = checkin.stressSources, !sources.isEmpty {
                            Text("压力源：" + sources.map { store.label(forStressSource: $0) }.joined(separator: "、"))
                                .font(.caption2)
                                .foregroundStyle(Theme.textSecondary)
                                .lineLimit(2)
                        }
                    }
                    Spacer()
                }
            } else {
                Text("选一个今天的心情，坚持记录，AI 会生成你的职场情绪画像")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(MoodCheckinSelection.items) { m in
                            Button {
                                quickCheckin(moodID: m.id)
                            } label: {
                                LittleEnergyMoodTile(mood: m, size: 40)
                                .frame(width: 62, height: 66)
                                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.inputBg))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                Button {
                    showCheckin = true
                } label: {
                    Text("完整打卡（含压力源/备注）")
                        .font(.caption)
                        .foregroundStyle(Theme.primary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func quickCheckin(moodID: String) {
        Task {
            await store.checkinMood(mood: moodID, stressSources: [], note: "")
        }
    }

    // MARK: - 最新吐槽

    private var latestSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("最新吐槽")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                NavigationLink {
                    ComplaintTabView()
                } label: {
                    HStack(spacing: 2) {
                        Text("进入广场")
                        Image(systemName: "chevron.right")
                    }
                    .font(.caption)
                    .foregroundStyle(Theme.primary)
                }
            }
            if store.feedComplaints.isEmpty {
                Text(store.isServerMode ? "广场还很安静，发第一条吐槽吧" : "登录后解锁吐槽广场")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
                    .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
                    .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
            } else {
                ForEach(store.feedComplaints.prefix(3)) { complaint in
                    ComplaintCardView(complaint: complaint)
                }
            }
        }
    }

    // MARK: - AI 洞察入口

    private var aiEntryCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                if let profile = store.personality {
                    LittleEnergyAvatarView(
                        moodID: store.currentMoodID,
                        outfit: store.currentUser.littleEnergyOutfit,
                        size: 54
                    )
                    VStack(alignment: .leading, spacing: 2) {
                        Text("你的职场人格：\(profile.personality)")
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        Text("已累计 \(profile.stats.totalComplaints) 条吐槽记录")
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                    }
                } else {
                    Image(systemName: "sparkles")
                        .font(.title2)
                        .foregroundStyle(Theme.primary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text("AI 职场人格画像")
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        Text(store.isServerMode ? "吐槽几条后，AI 帮你画像" : "登录后解锁 AI 洞察")
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary.opacity(0.6))
            }
            Text("完整报告（情绪趋势 / 人际洞察 / AI 建议）在「AI 洞察」Tab 查看")
                .font(.caption2)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
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
