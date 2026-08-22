import SwiftUI

/// 应用主框架：6 大 Tab（首页 / 吐槽广场 / 同事属性 / AI 洞察 / 消息 / 我的）
/// 职场关系操作系统 v2：同事属性 + 公司属性 + 情绪打卡 + AI + 关系雷达
struct ContentView: View {
    @EnvironmentObject private var store: MockDataStore
    @State private var tabIndex = 0
    @State private var updateInfo: ServerVersion?
    @AppStorage("jiyu.syncHistory") private var syncHistory = true
    @AppStorage("jiyu.syncHistoryChosen") private var syncChosen = false
    @State private var showSyncChoice = false

    var body: some View {
        TabView(selection: $tabIndex) {
            NavigationStack {
                StatusHomeView()
            }
            .tabItem {
                Label("首页", systemImage: "house")
            }
            .tag(0)

            NavigationStack {
                ComplaintTabView()
            }
            .tabItem {
                Label("吐槽广场", systemImage: "flame")
            }
            .tag(1)

            NavigationStack {
                ColleagueTabView()
            }
            .tabItem {
                Label("同事属性", systemImage: "person.2")
            }
            .tag(2)

            NavigationStack {
                AITabView()
            }
            .tabItem {
                Label("AI 洞察", systemImage: "sparkles")
            }
            .tag(3)

            NavigationStack {
                MessageView()
            }
            .tabItem {
                Label("消息", systemImage: "message")
            }
            .badge(store.unreadTotal > 0 ? store.unreadTotal : 0)
            .tag(4)

            NavigationStack {
                MineView()
            }
            .tabItem {
                Label("我的", systemImage: "person")
            }
            .tag(5)
        }
        .tint(Theme.primary)
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
