import SwiftUI
import Foundation

/// 首页重构：单一服务端聚合快照驱动的纵向信息流
/// 参考图顺序：问候/Hero → 今日情绪卡 → 最新吐槽 → 职场人格
/// 加载策略：缓存/骨架先渲染，无全屏无限转圈；失败时分区重试
struct HomeOverviewView: View {
    @EnvironmentObject private var store: MockDataStore

    @State private var showCheckin = false
    @State private var showCompose = false
    @State private var showAI = false
    @State private var showSearch = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: HomeMetrics.sectionGap) {
                content
            }
            .padding(.horizontal, HomeMetrics.pageHorizontal)
            .padding(.top, 10)
            .padding(.bottom, 28)
        }
        .background {
            ZStack {
                Theme.homeBackground
                UIAsset.appBackground.image
                    .resizable()
                    .scaledToFill()
                    .opacity(0.46)
            }
            .ignoresSafeArea()
        }
        .navigationTitle("首页")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    showCompose = true
                } label: {
                    UIAssetImage(.publishComplaint, size: 24)
                }
                .accessibilityLabel("发吐槽")
            }
        }
        .refreshable {
            if store.isServerMode {
                await store.loadHomeOverview(force: true)
            }
        }
        .task {
            if store.isServerMode {
                await store.loadHomeOverview()
            }
        }
        .navigationDestination(for: HomeRoute.self) { route in
            switch route {
            case .plaza:
                ComplaintTabView()
            case .myComplaints:
                ComplaintTabView(initialMode: .mine)
            }
        }
        // 核心操作都以完整页面进入，避免桌面端与移动端出现只展开半页的中断感。
        .fullScreenCover(isPresented: $showCheckin) { MoodCheckinView() }
        .fullScreenCover(isPresented: $showCompose) { ComplaintComposeView() }
        .fullScreenCover(isPresented: $showAI) { NavigationStack { AITabView() } }
        .fullScreenCover(isPresented: $showSearch) { NavigationStack { HomeSearchView() } }
    }

    // MARK: - 分区状态（缓存 / 骨架 / 失败重试 / 内容）

    @ViewBuilder
    private var content: some View {
        if store.isServerMode, store.homeOverview == nil {
            switch store.homeOverviewPhase {
            case .loading:
                skeletonSections
            case .failed(let message):
                retrySection(message)
            case .idle, .loaded:
                sections
            }
        } else {
            sections
        }
    }

    /// 参考图顺序的信息流
    private var sections: some View {
        VStack(alignment: .leading, spacing: HomeMetrics.sectionGap) {
            HomeHeroView(onSearch: { showSearch = true })
            HomeMoodCard(onFullCheckin: { showCheckin = true })
            HomeComplaintCard()
            HomePersonalityCard(onOpenAI: { showAI = true })
        }
    }

    /// 稳定骨架（非阻塞遮罩，无无限转圈）
    private var skeletonSections: some View {
        VStack(alignment: .leading, spacing: HomeMetrics.sectionGap) {
            VStack(alignment: .leading, spacing: 10) {
                skeletonBar(width: 180, height: 26)
                skeletonBar(width: 220, height: 14)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .modifier(HomeCardStyle())

            VStack(alignment: .leading, spacing: 12) {
                skeletonBar(width: 120, height: 16)
                skeletonBar(width: 240, height: 12)
                HStack(spacing: 10) {
                    ForEach(0..<5, id: \.self) { _ in
                        skeletonBar(width: 48, height: 64, radius: 14)
                    }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .modifier(HomeCardStyle())

            VStack(alignment: .leading, spacing: 10) {
                skeletonBar(width: 110, height: 16)
                skeletonBar(width: .infinity, height: 120, radius: 16)
            }
            .modifier(HomeCardStyle())

            VStack(alignment: .leading, spacing: 10) {
                skeletonBar(width: 100, height: 16)
                skeletonBar(width: 200, height: 12)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .modifier(HomeCardStyle())
        }
    }

    private func skeletonBar(width: CGFloat, height: CGFloat, radius: CGFloat = 6, circle: Bool = false) -> some View {
        RoundedRectangle(cornerRadius: circle ? height / 2 : radius, style: .continuous)
            .fill(Theme.divider.opacity(0.7))
            .frame(width: width == .infinity ? nil : width, height: height)
            .frame(maxWidth: width == .infinity ? .infinity : nil)
    }

    private func retrySection(_ message: String) -> some View {
        VStack(spacing: 14) {
            Image(systemName: "wifi.exclamationmark")
                .font(.title2)
                .foregroundStyle(Theme.warning)
            Text(message)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
            Button("重试") {
                Task { await store.loadHomeOverview(force: true) }
            }
            .font(.subheadline)
            .bold()
            .foregroundStyle(.white)
            .padding(.horizontal, 28)
            .frame(minHeight: HomeMetrics.minTapTarget)
            .background(Capsule().fill(Theme.primary))
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
        .modifier(HomeCardStyle())
    }
}

/// 首页内部导航路由（统计卡点击目的地）
enum HomeRoute: Hashable {
    case plaza
    case myComplaints
}

/// 搜索入口：复用现有 /api/search 能力的最小结果页（不新建搜索子系统）
struct HomeSearchView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var results: SearchResults?
    @State private var searching = false
    @State private var failed = false
    @FocusState private var searchFocused: Bool
    @AppStorage("home.search.history") private var storedHistory = "[]"

    private let hotTerms = ["摸鱼型", "已读不回", "周末加班", "甩锅", "喜欢 PUA"]

    private var recentSearches: [String] {
        (try? JSONDecoder().decode([String].self, from: Data(storedHistory.utf8))) ?? []
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                searchField

                if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, results == nil, !searching {
                    discoverContent
                } else if failed {
                    Label("搜索失败，请重试", systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(Theme.danger)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else if searching {
                    ProgressView()
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
                } else if let results {
                    if results.complaints.isEmpty && results.colleagues.isEmpty && results.companies.isEmpty {
                        Text("没有找到相关结果")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 40)
                    } else {
                        if !results.complaints.isEmpty {
                            sectionTitle("吐槽")
                            ForEach(results.complaints, id: \.id) { hit in
                                NavigationLink {
                                    ComplaintDetailView(complaintID: hit.id)
                                } label: {
                                    searchComplaintRow(hit)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        if !results.colleagues.isEmpty {
                            sectionTitle("同事")
                            ForEach(results.colleagues, id: \.id) { hit in
                                HStack {
                                    SymbolAvatar(symbol: "person.fill", size: 36)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(hit.name)
                                            .font(.subheadline)
                                            .bold()
                                            .foregroundStyle(Theme.textPrimary)
                                        Text([hit.position, hit.department].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textSecondary)
                                    }
                                    Spacer()
                                }
                                .padding(12)
                                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.cardBg))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.divider, lineWidth: 1))
                            }
                        }
                        if !results.companies.isEmpty {
                            sectionTitle("公司")
                            ForEach(results.companies, id: \.id) { hit in
                                HStack {
                                    Image(systemName: "building.2")
                                        .foregroundStyle(Theme.primary)
                                        .frame(width: 36, height: 36)
                                        .background(Circle().fill(Theme.primary.opacity(0.10)))
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(hit.name)
                                            .font(.subheadline)
                                            .bold()
                                            .foregroundStyle(Theme.textPrimary)
                                        Text([hit.industry, hit.scale].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textSecondary)
                                    }
                                    Spacer()
                                }
                                .padding(12)
                                .background(RoundedRectangle(cornerRadius: 14).fill(Theme.cardBg))
                                .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.divider, lineWidth: 1))
                            }
                        }
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("搜索")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("关闭") { dismiss() }
            }
        }
    }

    private var searchField: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass")
                .foregroundStyle(Theme.textSecondary)
            TextField("搜索吐槽、同事或公司", text: $query)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .onSubmit { runSearch() }
                .focused($searchFocused)
            if !query.isEmpty {
                Button {
                    query = ""
                    results = nil
                    failed = false
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Theme.textSecondary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12)
        .frame(minHeight: 44)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.inputBg))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: 1))
    }

    private func sectionTitle(_ title: String) -> some View {
        Text(title)
            .font(.subheadline)
            .bold()
            .foregroundStyle(Theme.textPrimary)
            .padding(.top, 4)
    }

    private var discoverContent: some View {
        VStack(alignment: .leading, spacing: 20) {
            discoverTitle("热门搜索")
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 10) {
                    ForEach(hotTerms, id: \.self) { term in
                        Button(term) { search(term) }
                            .font(.caption)
                            .foregroundStyle(Theme.primary)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Theme.cardBg))
                            .overlay(Capsule().stroke(Theme.divider, lineWidth: 1))
                    }
                }
            }

            discoverTitle("快捷分类")
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                searchCategory(icon: "text.bubble.fill", title: "吐槽内容", subtitle: "搜吐槽关键词")
                searchCategory(icon: "person.2.fill", title: "同事昵称", subtitle: "搜同事或称呼")
                searchCategory(icon: "building.2.fill", title: "公司名称", subtitle: "搜公司或部门")
                searchCategory(icon: "tag.fill", title: "行为标签", subtitle: "搜行为或特征")
            }

            if !recentSearches.isEmpty {
                HStack {
                    discoverTitle("最近搜索")
                    Spacer()
                    Button("清空") { storedHistory = "[]" }
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                .padding(.top, 2)
                VStack(spacing: 0) {
                    ForEach(recentSearches, id: \.self) { term in
                        Button { search(term) } label: {
                            HStack {
                                Image(systemName: "clock")
                                    .foregroundStyle(Theme.textSecondary)
                                Text(term)
                                    .foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Image(systemName: "chevron.right")
                                    .font(.caption)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            .font(.subheadline)
                            .padding(14)
                        }
                        .buttonStyle(.plain)
                        if term != recentSearches.last { Divider() }
                    }
                }
                .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
                .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
            }

            VStack(spacing: 8) {
                LittleEnergyAvatarView(moodID: "xnz_motivated", outfit: store.currentUser.littleEnergyOutfit, size: 132)
                Text("输入关键词，发现同频吐槽")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
        }
    }

    private func discoverTitle(_ title: String) -> some View {
        Text(title)
            .font(.headline)
            .foregroundStyle(Theme.textPrimary)
    }

    private func searchCategory(icon: String, title: String, subtitle: String) -> some View {
        Button {
            query = ""
            results = nil
            searchFocused = true
        } label: {
            HStack(spacing: 10) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(Theme.primary)
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Theme.primary.opacity(0.10)))
                VStack(alignment: .leading, spacing: 3) {
                    Text(title).font(.subheadline).bold()
                    Text(subtitle).font(.caption2).foregroundStyle(Theme.textSecondary)
                }
                Spacer(minLength: 0)
            }
            .foregroundStyle(Theme.textPrimary)
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private func searchComplaintRow(_ hit: SearchComplaintHit) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(hit.content)
                .font(.subheadline)
                .foregroundStyle(Theme.textPrimary)
                .lineLimit(2)
            Text(hit.isAnonymous ? "匿名" : hit.snippet)
                .font(.caption2)
                .foregroundStyle(Theme.textSecondary)
                .lineLimit(1)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.divider, lineWidth: 1))
    }

    private func search(_ term: String) {
        query = term
        runSearch()
    }

    private func runSearch() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        failed = false
        searching = true
        Task {
            do {
                results = try await APIClient.shared.searchAll(query: trimmed)
                let history = [trimmed] + recentSearches.filter { $0 != trimmed }
                storedHistory = String(data: (try? JSONEncoder().encode(Array(history.prefix(6)))) ?? Data("[]".utf8), encoding: .utf8) ?? "[]"
            } catch {
                failed = true
            }
            searching = false
        }
    }
}
