import SwiftUI

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
        .sheet(isPresented: $showCheckin) { MoodCheckinView() }
        .sheet(isPresented: $showCompose) { ComplaintComposeView() }
        .sheet(isPresented: $showAI) { NavigationStack { AITabView() } }
        .sheet(isPresented: $showSearch) { NavigationStack { HomeSearchView() } }
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

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                searchField

                if failed {
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
                } else {
                    Text("输入关键词，搜索吐槽、同事或公司")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 40)
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
            if !query.isEmpty {
                Button {
                    query = ""
                    results = nil
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

    private func runSearch() {
        let trimmed = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        failed = false
        searching = true
        Task {
            do {
                results = try await APIClient.shared.searchAll(query: trimmed)
            } catch {
                failed = true
            }
            searching = false
        }
    }
}
