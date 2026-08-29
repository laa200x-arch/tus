import SwiftUI

/// 应用主框架：5 项导航（首页 / 广场 / 中间发布 / 消息 / 我的）
/// 中间发布按钮打开统一发布面板，不是可选中页面；原 AI Tab 移除，
/// AI 洞察通过首页人格卡与「我的」现有入口访问。
enum HomeTab: Int, CaseIterable, Identifiable {
    case home = 0
    case plaza = 1
    case compose = 2
    case messages = 3
    case mine = 4

    var id: Int { rawValue }

    var title: String {
        switch self {
        case .home: return "首页"
        case .plaza: return "广场"
        case .compose: return ""
        case .messages: return "消息"
        case .mine: return "我的"
        }
    }

    var icon: String {
        switch self {
        case .home: return "house"
        case .plaza: return "flame"
        case .compose: return "plus.circle.fill"
        case .messages: return "message"
        case .mine: return "person"
        }
    }

    var asset: UIAsset {
        switch self {
        case .home: return .navHome
        case .plaza: return .navPlaza
        case .compose: return .navPublish
        case .messages: return .navMessages
        case .mine: return .navProfile
        }
    }

    /// 中间发布动作不是可选中的 Tab 页
    var isComposeAction: Bool { self == .compose }
}

struct ContentView: View {
    @EnvironmentObject private var store: MockDataStore
    @State private var tabIndex: HomeTab = .home
    @State private var lastRealTab: HomeTab = .home
    @State private var showCompose = false
    @State private var updateInfo: ServerVersion?
    @AppStorage("jiyu.syncHistory") private var syncHistory = true
    @AppStorage("jiyu.syncHistoryChosen") private var syncChosen = false
    @State private var showSyncChoice = false

    var body: some View {
        TabView(selection: $tabIndex) {
            NavigationStack {
                HomeOverviewView()
            }
            .tabItem {
                HomeTab.home.asset.image
                Text(HomeTab.home.title)
            }
            .tag(HomeTab.home)

            NavigationStack {
                ComplaintTabView()
            }
            .tabItem {
                HomeTab.plaza.asset.image
                Text(HomeTab.plaza.title)
            }
            .tag(HomeTab.plaza)

            // 中间发布按钮：选中即弹出统一发布面板，并回到上一个真实 Tab
            Color.clear
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .tabItem {
                    HomeTab.compose.asset.image
                }
                .accessibilityLabel("发吐槽")
                .tag(HomeTab.compose)

            NavigationStack {
                MessageView()
            }
            .tabItem {
                HomeTab.messages.asset.image
                Text(HomeTab.messages.title)
            }
            .badge(store.unreadTotal > 0 ? store.unreadTotal : 0)
            .tag(HomeTab.messages)

            NavigationStack {
                MineView()
            }
            .tabItem {
                HomeTab.mine.asset.image
                Text(HomeTab.mine.title)
            }
            .tag(HomeTab.mine)
        }
        .tint(Theme.primary)
        .onChange(of: tabIndex) { newValue in
            if newValue == .compose {
                showCompose = true
                tabIndex = lastRealTab
            } else {
                lastRealTab = newValue
            }
        }
        .sheet(isPresented: $showCompose) { PublishMenuView() }
        .task {
            await checkForUpdate()
            // 首次登录后询问聊天记录同步方式（之后可在「我的 → 设置」修改）
            if TokenStore.token != nil && !syncChosen {
                showSyncChoice = true
            }
        }
        .alert("同步聊天记录", isPresented: $showSyncChoice) {
            Button("自动加载历史记录（推荐）") {
                syncHistory = true
                syncChosen = true
            }
            Button("不自动加载，仅新消息") {
                syncHistory = false
                syncChosen = true
            }
        } message: {
            Text("不同设备登录同一账号时，可同步之前的聊天记录。你可以随时在「我的 → 聊天记录同步」中修改。")
        }
        .alert(
            "发现新版本 \(updateInfo?.current ?? "")",
            isPresented: Binding(
                get: { updateInfo != nil },
                set: { if !$0 { updateInfo = nil } }
            )
        ) {
            Button("去下载") {
                if let urlString = updateInfo?.downloadUrl,
                   let url = URL(string: urlString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("稍后再说", role: .cancel) {
                updateInfo = nil
            }
        } message: {
            Text(updateInfo?.updateMessage ?? "")
        }
    }

    /// 版本更新检查（方案：服务器 /api/version，有新版本则弹窗提示）
    private func checkForUpdate() async {
        guard TokenStore.token != nil else { return }
        guard let version = try? await APIClient.shared.fetchVersion() else { return }
        let localVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        if version.current != localVersion {
            updateInfo = version
        }
    }
}

private enum PublishAction: String, CaseIterable, Identifiable {
    case complaint
    case dynamic
    case mood
    case colleague

    var id: String { rawValue }

    var title: String {
        switch self {
        case .complaint: return "发布吐槽"
        case .dynamic: return "记录情绪动态"
        case .mood: return "今日情绪打卡"
        case .colleague: return "新增同事档案"
        }
    }

    var subtitle: String {
        switch self {
        case .complaint: return "吐槽一下，轻松一下"
        case .dynamic: return "记录此刻的职场状态"
        case .mood: return "选择小能仔今日情绪"
        case .colleague: return "补充一位同事的画像"
        }
    }

    var asset: UIAsset {
        switch self {
        case .complaint: return .publishComplaint
        case .dynamic: return .publishDynamic
        case .mood: return .publishMood
        case .colleague: return .publishColleague
        }
    }
}

private struct PublishMenuView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var action: PublishAction?

    var body: some View {
        NavigationStack {
            VStack(spacing: 12) {
                Text("选择你现在想记录的内容")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)

                ForEach(PublishAction.allCases) { item in
                    Button { action = item } label: {
                        HStack(spacing: 14) {
                            UIAssetImage(item.asset, size: 48)
                            VStack(alignment: .leading, spacing: 4) {
                                Text(item.title)
                                    .font(.headline)
                                    .foregroundStyle(Theme.textPrimary)
                                Text(item.subtitle)
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            UIAssetImage(.actionChevron, size: 14, tint: Theme.textSecondary)
                        }
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardBg))
                        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.divider, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
                Spacer()
            }
            .padding(16)
            .background(Theme.bg)
            .navigationTitle("发布")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
            .sheet(item: $action) { item in
                switch item {
                case .complaint: ComplaintComposeView()
                case .dynamic: StatusComposeView()
                case .mood: MoodCheckinView()
                case .colleague: ColleagueEditView()
                }
            }
        }
    }
}

private struct StatusComposeView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss
    @State private var content = ""
    @State private var isSending = false
    @State private var warning: String?

    var body: some View {
        NavigationStack {
            VStack(alignment: .leading, spacing: 12) {
                Text("今天的职场状态")
                    .font(.headline)
                TextEditor(text: $content)
                    .frame(minHeight: 180)
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Theme.inputBg))
                Text("将使用今天全局一致的小能仔情绪与服装发布。")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                Button { submit() } label: {
                    HStack {
                        UIAssetImage(.actionSend, size: 18, tint: .white)
                        Text(isSending ? "发布中…" : "发布动态")
                    }
                    .font(.headline)
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Theme.primary))
                }
                .disabled(content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
            }
            .padding(16)
            .navigationTitle("记录动态")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .alert("发布失败", isPresented: Binding(get: { warning != nil }, set: { if !$0 { warning = nil } })) {
                Button("好的", role: .cancel) {}
            } message: {
                Text(warning ?? "")
            }
        }
    }

    private func submit() {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        isSending = true
        Task {
            let result = await store.postStatus(content: text, mood: store.currentMoodID)
            isSending = false
            switch result {
            case .sent: dismiss()
            case .blocked(let message), .failed(let message): warning = message
            }
        }
    }
}

#Preview {
    ContentView()
        .environmentObject(MockDataStore.shared)
}
