import SwiftUI

/// 首页四张紧凑横向统计卡（参考图四宫格）：今日打卡 / 广场吐槽 / 我的吐槽 / 同事档案
struct HomeStatsGrid: View {
    @EnvironmentObject private var store: MockDataStore

    var onCheckin: () -> Void
    var onColleagues: () -> Void

    /// 聚合快照优先，未加载时回退本地既有状态（演示模式 / 首页尚未就绪）
    private var stats: HomeOverviewStats? { store.homeOverview?.stats }

    private var moodCheckedToday: Bool { stats?.moodCheckedToday ?? store.moodCheckedToday }
    private var plazaCount: Int { stats?.plazaComplaintCount ?? store.feedComplaints.count }
    private var myCount: Int { stats?.myComplaintCount ?? store.myComplaints.count }
    private var colleagueCount: Int { stats?.colleagueCount ?? store.colleagues.count }

    var body: some View {
        LazyVGrid(
            columns: [
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10),
                GridItem(.flexible(), spacing: 10)
            ],
            spacing: 10
        ) {
            Button(action: onCheckin) {
                statCard(
                    asset: .featureCheckin,
                    title: "今日打卡",
                    value: moodCheckedToday ? "已打卡" : "未打卡",
                    tint: moodCheckedToday ? Theme.success : Theme.warning
                )
            }
            .buttonStyle(.plain)

            NavigationLink(value: HomeRoute.plaza) {
                statCard(
                    asset: .featurePlaza,
                    title: "广场吐槽",
                    value: "\(plazaCount)",
                    tint: Theme.secondary
                )
            }
            .buttonStyle(.plain)

            NavigationLink(value: HomeRoute.myComplaints) {
                statCard(
                    asset: .featureMyComplaints,
                    title: "我的吐槽",
                    value: "\(myCount)",
                    tint: Theme.primary
                )
            }
            .buttonStyle(.plain)

            Button(action: onColleagues) {
                statCard(
                    asset: .featureColleagues,
                    title: "同事档案",
                    value: "\(colleagueCount)",
                    tint: Theme.primaryDeep
                )
            }
            .buttonStyle(.plain)
        }
    }

    private func statCard(asset: UIAsset, title: String, value: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            UIAssetImage(asset, size: 34)
                .frame(width: 36, height: 36)
            VStack(alignment: .leading, spacing: 3) {
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
                    .lineLimit(1)
                Text(value)
                    .font(.footnote)
                    .bold()
                    .foregroundStyle(Theme.homeNavy)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 92, alignment: .leading)
        .padding(10)
        .contentShape(Rectangle())
        .modifier(HomeCardStyle())
        .frame(minHeight: HomeMetrics.minTapTarget)
    }
}
