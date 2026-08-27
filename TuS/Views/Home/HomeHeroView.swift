import SwiftUI

/// 首页 Hero：问候 + 辅助文案 + 搜索入口 + 右侧当前情绪/穿搭小能仔
/// 参考图视觉：深藏青大标题、灰色辅助文案、右侧小能仔 Hero、柔和光晕背景
struct HomeHeroView: View {
    @EnvironmentObject private var store: MockDataStore
    var onSearch: () -> Void

    var body: some View {
        ZStack(alignment: .topTrailing) {
            // 小能仔 Hero 光晕（柔和紫蓝）
            RadialGradient(
                colors: [
                    Theme.homeGlowLavender.opacity(0.9),
                    Theme.homeGlowLavender.opacity(0.0)
                ],
                center: .topTrailing,
                startRadius: 4,
                endRadius: 130
            )
            .frame(width: 200, height: 200)
            .offset(x: 20, y: -14)

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(headline)
                        .font(.system(size: 26, weight: .bold, design: .rounded))
                        .foregroundStyle(Theme.homeNavy)
                        .lineLimit(1)
                        .minimumScaleFactor(0.6)
                    Text("今天也要好好上班（和好好吐槽）")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                        .minimumScaleFactor(0.7)

                    searchEntry
                        .padding(.top, 10)
                }
                Spacer(minLength: 4)
                LittleEnergyAvatarView(
                    moodID: store.currentMoodID,
                    outfit: store.currentUser.littleEnergyOutfit,
                    size: 104
                )
                .shadow(color: Theme.primary.opacity(0.18), radius: 16, x: 0, y: 6)
            }
        }
        .padding(.top, 6)
    }

    /// 问候语：优先使用服务端聚合的时段，否则按本地时间推导
    private var greeting: String {
        switch store.homeOverview?.greetingPeriod {
        case "morning": return "早上好"
        case "afternoon": return "下午好"
        case "evening": return "晚上好"
        default:
            let hour = Calendar.current.component(.hour, from: Date())
            switch hour {
            case 5..<12: return "早上好"
            case 12..<18: return "下午好"
            default: return "晚上好"
            }
        }
    }

    private var headline: String {
        "\(greeting)，\(store.currentUser.userName)"
    }

    /// 搜索入口（圆角胶囊 + 放大镜），点击进入搜索
    private var searchEntry: some View {
        Button(action: onSearch) {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                Text("搜索吐槽、同事或公司")
                    .font(.footnote)
                    .foregroundStyle(Theme.textSecondary)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 14)
            .frame(height: HomeMetrics.minTapTarget)
            .background(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Theme.homeCardTranslucent)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .stroke(Theme.divider, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .frame(maxWidth: 260)
    }
}
