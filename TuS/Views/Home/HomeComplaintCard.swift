import SwiftUI

/// 最新吐槽卡：标题 + 进入广场入口 + 一条重点吐槽卡（保留现有点赞 / 共鸣 / 评论 / 分享能力）
struct HomeComplaintCard: View {
    @EnvironmentObject private var store: MockDataStore

    /// 聚合快照优先；未就绪时回退本地广场最新一条
    private var latest: ComplaintModel? {
        if let summary = store.homeOverview?.latestComplaints.first {
            return ComplaintModel(summary: summary)
        }
        return store.feedComplaints.first
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("最新吐槽")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.homeNavy)
                Spacer()
                NavigationLink {
                    ComplaintTabView()
                } label: {
                    HStack(spacing: 2) {
                        Text("进入广场")
                        UIAssetImage(.actionChevron, size: 13, tint: Theme.primary)
                    }
                    .font(.caption)
                    .bold()
                    .foregroundStyle(Theme.primary)
                }
                .buttonStyle(.plain)
                .frame(minHeight: HomeMetrics.minTapTarget)
            }

            if let latest {
                ComplaintCardView(complaint: latest)
            } else {
                Text(store.isServerMode ? "广场还很安静，发第一条吐槽吧" : "登录后解锁吐槽广场")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 28)
            }
        }
        .modifier(HomeCardStyle())
    }
}

extension ComplaintModel {
    /// 首页聚合的最新吐槽摘要 → 本地吐槽模型（保留点赞 / 共鸣等既有能力）
    init(summary: HomeComplaintSummary) {
        self.init(
            id: summary.id,
            userId: summary.userId ?? "",
            authorName: summary.authorName,
            avatarSymbol: summary.avatarSymbol,
            littleEnergyOutfit: summary.littleEnergyOutfit,
            isAnonymous: summary.isAnonymous,
            content: summary.content,
            colleagueId: nil,
            colleagueName: nil,
            category: nil,
            behaviorTags: [],
            sentiment: summary.sentiment,
            aiExtracted: nil,
            likeCount: summary.likeCount,
            resonanceCount: summary.resonanceCount,
            hotScore: 0,
            liked: false,
            resonated: false,
            commentCount: summary.commentCount,
            resonanceRate: nil,
            time: summary.time
        )
    }
}
