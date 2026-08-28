import SwiftUI

/// 职场人格摘要卡：点击进入 AI 洞察（原 AI Tab 已移除，人格卡 + 我的 提供入口）
struct HomePersonalityCard: View {
    @EnvironmentObject private var store: MockDataStore

    var onOpenAI: () -> Void

    /// 聚合快照优先；未就绪时回退本地人格
    private var summary: HomePersonalitySummary? {
        store.homeOverview?.personality
    }

    var body: some View {
        Button(action: onOpenAI) {
            HStack(spacing: 12) {
                if let summary {
                    UIAssetImage(.toolAI, size: 38)
                        .frame(width: 44, height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Theme.primary.opacity(0.10))
                        )
                    VStack(alignment: .leading, spacing: 3) {
                        Text("你的职场人格：\(summary.name)")
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.homeNavy)
                        Text(summary.summary.isEmpty
                             ? "已累计 \(summary.totalComplaints) 条吐槽记录"
                             : summary.summary)
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(2)
                    }
                } else {
                    UIAssetImage(.toolAI, size: 38)
                        .frame(width: 44, height: 44)
                        .background(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .fill(Theme.primary.opacity(0.10))
                        )
                    VStack(alignment: .leading, spacing: 3) {
                        Text("AI 职场人格画像")
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.homeNavy)
                        Text(store.isServerMode ? "吐槽几条后，AI 帮你画像" : "登录后解锁 AI 洞察")
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                Spacer()
                UIAssetImage(.actionChevron, size: 14, tint: Theme.primary)
            }
            .frame(minHeight: 72)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .modifier(HomeCardStyle())
    }
}
