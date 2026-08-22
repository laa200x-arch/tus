import SwiftUI

/// 吐槽广场（Tab）：feed（热点/最新）+ 我的吐槽 + 热搜榜
struct ComplaintTabView: View {
    @EnvironmentObject private var store: MockDataStore
    @State private var mode: Mode = .hot
    @State private var showCompose = false

    enum Mode: String, CaseIterable, Identifiable {
        case hot = "热点"
        case new = "最新"
        case mine = "我的"
        var id: String { rawValue }
    }

    /// 当前展示列表
    private var list: [ComplaintModel] {
        switch mode {
        case .hot, .new:
            // 热点/最新由服务端排序，本地统一用 feedComplaints（加载时按 mode 请求）
            return store.feedComplaints
        case .mine:
            return store.myComplaints
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                modeChips
                if mode != .mine, !store.topics.isEmpty {
                    topicsCard
                }
                if list.isEmpty {
                    EmptyStateView(
                        icon: "flame",
                        title: mode == .mine ? "你还没有发过吐槽" : "广场还很安静",
                        message: mode == .mine
                            ? "点右上角「发吐槽」，写下今天让你无语的瞬间"
                            : "发第一条吐槽，让大家一起共鸣"
                    )
                } else {
                    ForEach(list) { complaint in
                        ComplaintCardView(complaint: complaint, allowDelete: mode == .mine)
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.bg)
        .navigationTitle("吐槽广场")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            if store.isServerMode {
                await store.refreshComplaints(sort: mode == .new ? "new" : "hot")
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
        .task {
            if store.isServerMode {
                await store.refreshComplaints(sort: mode == .new ? "new" : "hot")
            }
        }
        .onChange(of: mode) { newValue in
            if store.isServerMode, newValue != .mine {
                Task { await store.refreshComplaints(sort: newValue == .new ? "new" : "hot") }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("吐槽广场 · 职场树洞")
                .font(.title2)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            Text("匿名吐糟，抱团共鸣。禁止人身攻击与泄露隐私，文明发言。")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.top, 4)
    }

    private var modeChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(Mode.allCases) { m in
                    chip(m.rawValue, active: mode == m) { mode = m }
                }
            }
        }
    }

    private func chip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption)
                .fontWeight(active ? .semibold : .regular)
                .foregroundStyle(active ? .white : Theme.textPrimary)
                .padding(.horizontal, 14)
                .padding(.vertical, 6)
                .background(Capsule().fill(active ? Theme.primary : Theme.cardBg))
                .overlay(Capsule().stroke(Theme.divider, lineWidth: active ? 0 : 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 热搜榜

    private var topicsCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                Image(systemName: "flame.fill")
                    .foregroundStyle(Theme.secondary)
                Text("吐槽热搜榜")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("按热度实时更新")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
            ForEach(Array(store.topics.prefix(10).enumerated()), id: \.element.id) { index, topic in
                HStack(alignment: .top, spacing: 10) {
                    Text("\(index + 1)")
                        .font(.caption)
                        .bold()
                        .foregroundStyle(index < 3 ? Theme.secondary : Theme.textSecondary)
                        .frame(width: 18)
                    Text(topic.snippet)
                        .font(.caption)
                        .foregroundStyle(Theme.textPrimary)
                        .lineLimit(1)
                    Spacer()
                    Text("\(Int(topic.hotScore)) 热度")
                        .font(.caption2)
                        .foregroundStyle(Theme.secondary)
                }
                .padding(.vertical, 3)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }
}

/// 我的吐槽（「我的」页入口）
struct MyComplaintsView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(spacing: 12) {
                    if store.myComplaints.isEmpty {
                        EmptyStateView(
                            icon: "text.bubble",
                            title: "你还没有发过吐槽",
                            message: "去「吐槽广场」发布第一条吧"
                        )
                        .padding(.top, 60)
                    } else {
                        ForEach(store.myComplaints) { complaint in
                            ComplaintCardView(complaint: complaint, allowDelete: true)
                        }
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("我的吐槽（\(store.myComplaints.count)）")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            .refreshable {
                if store.isServerMode {
                    await store.refreshComplaints()
                }
            }
        }
    }
}

/// 单条吐槽卡片（点赞 / 共鸣 / 删除）
struct ComplaintCardView: View {
    @EnvironmentObject private var store: MockDataStore
    let complaint: ComplaintModel
    var allowDelete: Bool = false

    @State private var showDeleteConfirm = false

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                SymbolAvatar(symbol: complaint.avatarSymbol, size: 40)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(complaint.authorName)
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        if complaint.isAnonymous {
                            Text("匿名")
                                .font(.caption2)
                                .foregroundStyle(Theme.textSecondary)
                                .padding(.horizontal, 6)
                                .padding(.vertical, 1)
                                .background(Capsule().fill(Theme.inputBg))
                        }
                        Spacer()
                        Text(Formatters.timeText(complaint.time))
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    if let colleagueName = complaint.colleagueName, !colleagueName.isEmpty {
                        HStack(spacing: 4) {
                            Image(systemName: "person.fill")
                                .font(.caption2)
                            Text("关于 \(colleagueName)")
                                .font(.caption2)
                        }
                        .foregroundStyle(Theme.secondary)
                    }
                }
            }

            Text(complaint.content)
                .font(.subheadline)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(4)

            if !tagChips.isEmpty {
                tagRow
            }

            actionRow
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
        .confirmationDialog("删除这条吐槽？", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("删除", role: .destructive) {
                Task { await store.deleteComplaint(id: complaint.id) }
            }
            Button("取消", role: .cancel) {}
        }
    }

    /// 标签（同事类型 / 行为标签 / 情绪倾向）
    private var tagChips: [(String, Color)] {
        var chips: [(String, Color)] = []
        if let category = complaint.category {
            chips.append((store.label(forColleagueType: category), Theme.secondary))
        }
        for tag in complaint.behaviorTags {
            chips.append((store.label(forBehaviorTag: tag), Theme.primary))
        }
        if let sentiment = complaint.sentiment {
            chips.append(("情绪：" + store.label(forSentiment: sentiment), Theme.success))
        }
        return chips
    }

    private var tagRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(Array(tagChips.enumerated()), id: \.offset) { _, chip in
                    Text(chip.0)
                        .font(.caption2)
                        .foregroundStyle(chip.1)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Capsule().fill(chip.1.opacity(0.10)))
                }
            }
        }
    }

    private var actionRow: some View {
        HStack(spacing: 20) {
            Button {
                Task { await store.toggleLike(complaint) }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: complaint.liked ? "heart.fill" : "heart")
                        .foregroundStyle(complaint.liked ? Theme.danger : Theme.textSecondary)
                    Text("\(complaint.likeCount)")
                        .foregroundStyle(Theme.textSecondary)
                }
                .font(.caption)
            }
            .buttonStyle(.plain)

            Button {
                Task { await store.toggleResonate(complaint) }
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: complaint.resonated ? "bubble.left.and.bubble.right.fill" : "bubble.left.and.bubble.right")
                        .foregroundStyle(complaint.resonated ? Theme.primary : Theme.textSecondary)
                    Text("共鸣 \(complaint.resonanceCount)")
                        .foregroundStyle(Theme.textSecondary)
                }
                .font(.caption)
            }
            .buttonStyle(.plain)

            Spacer()

            if allowDelete {
                Button {
                    showDeleteConfirm = true
                } label: {
                    Label("删除", systemImage: "trash")
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                }
                .buttonStyle(.plain)
            }
        }
    }
}

#Preview {
    NavigationStack {
        ComplaintTabView()
            .environmentObject(MockDataStore.shared)
    }
}
