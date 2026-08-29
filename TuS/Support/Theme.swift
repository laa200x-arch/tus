import SwiftUI

/// 设计系统（紫色主题：主色紫罗兰 + 暖橙强调 + 浅紫灰背景，现代卡片风）
/// 参考：主色 #6C5CE7 / 背景 #F5F6FC / 卡片纯白 / 强调橙 / 成功绿 / 大圆角胶囊
enum Theme {
    /// 全产品统一柔光底图；界面按自身布局决定缩放与透明度。
    static let appBackgroundAsset = UIAsset.appBackground.image
    /// 主色：紫罗兰（主按钮、选中态、认证图标、信用环）
    static let primary = Color(red: 0.42, green: 0.36, blue: 0.91)   // #6C5CE7
    /// 深紫（渐变/头像底）
    static let primaryDeep = Color(red: 0.45, green: 0.34, blue: 0.98) // #7257FA
    /// 辅助色：暖橙（曝光/亮点/兴趣标签）
    static let secondary = Color(red: 0.96, green: 0.62, blue: 0.04)  // #F59E0B
    /// 页面背景（统一纯白，避免任何灰底/暗灰观感）
    static let bg = Color.white
    /// 卡片底色（纯白）
    static let cardBg = Color.white
    /// 输入框/未选中按钮固定浅灰（不使用 systemGray 语义色，防止暗黑模式反转成黑块）
    static let inputBg = Color(red: 0.949, green: 0.953, blue: 0.969)   // #F2F3F7
    static let textPrimary = Color(red: 0.12, green: 0.16, blue: 0.22)   // #1F2937
    static let textSecondary = Color(red: 0.42, green: 0.45, blue: 0.50) // #6B7280
    static let divider = Color(red: 0.93, green: 0.94, blue: 0.97)      // #EEF0F6
    static let success = Color(red: 0.13, green: 0.77, blue: 0.37)      // #22C55E
    static let warning = Color(red: 0.96, green: 0.62, blue: 0.04)      // #F59E0B
    static let danger = Color(red: 0.94, green: 0.27, blue: 0.27)       // #EF4444

    /// 品牌渐变（头像/横幅）
    static let gradient = LinearGradient(
        colors: [primaryDeep, primary],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    // MARK: - 首页重构视觉体系（参考图：深藏青标题 / 柔和紫蓝光晕 / 半透明白卡 / 紫色 CTA）

    /// 深藏青标题（参考图标题色）
    static let homeNavy = Color(red: 0.07, green: 0.10, blue: 0.20)        // #121A33
    /// 柔和紫罗兰背景光晕
    static let homeGlowLavender = Color(red: 0.91, green: 0.90, blue: 0.99) // #E8E6FD
    /// 柔和淡蓝背景光晕
    static let homeGlowBlue = Color(red: 0.87, green: 0.93, blue: 0.99)    // #DEEDFC
    /// 半透明白卡（参考图卡片质感）
    static let homeCardTranslucent = Color.white.opacity(0.86)

    /// 首页背景：浅紫到淡蓝的柔和渐变 + 顶部 Hero 光晕
    static let homeBackground = LinearGradient(
        colors: [homeGlowLavender, Color.white, homeGlowBlue],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

/// 首页布局常量（参考图视觉契约：20 页边距 / 24 圆角 / 18 间距 / 18 阴影）
enum HomeMetrics {
    static let pageHorizontal: CGFloat = 20
    static let cardRadius: CGFloat = 24
    static let sectionGap: CGFloat = 18
    static let cardShadowRadius: CGFloat = 18
    static let minTapTarget: CGFloat = 44
}

/// 首页卡片样式：半透明白底 + 24 圆角 + 克制阴影
struct HomeCardStyle: ViewModifier {
    func body(content: Content) -> some View {
        content
            .padding(16)
            .background(
                RoundedRectangle(cornerRadius: HomeMetrics.cardRadius, style: .continuous)
                    .fill(Theme.homeCardTranslucent)
            )
            .shadow(
                color: Theme.primary.opacity(0.10),
                radius: HomeMetrics.cardShadowRadius,
                x: 0,
                y: 8
            )
            .overlay(
                RoundedRectangle(cornerRadius: HomeMetrics.cardRadius, style: .continuous)
                    .stroke(Color.white.opacity(0.6), lineWidth: 1)
            )
    }
}

/// 通用时间格式
enum Formatters {
    static let timeFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "MM-dd HH:mm"
        return f
    }()

    static func timeText(_ date: Date) -> String {
        timeFormatter.string(from: date)
    }
}
