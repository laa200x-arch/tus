import SwiftUI

/// 应用主框架：5 项导航（首页 / 广场 / 中间发布 / 消息 / 我的）
/// 中间发布按钮打开现有吐槽发布 Sheet，不是可选中页面；原 AI Tab 移除，
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

            // 中间发布按钮：选中即弹出吐槽发布 Sheet，并回到上一个真实 Tab
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
        .sheet(isPresented: $showCompose) {
            ComplaintComposeView()
        }
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

#Preview {
    ContentView()
        .environmentObject(MockDataStore.shared)
}
