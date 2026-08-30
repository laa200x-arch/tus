import SwiftUI

/// 启动加载页（有持久化 Token 时先显示，恢复账号数据后再进主界面）
/// 含品牌弹入动画（与 Windows 端启动动画风格一致）
struct LaunchView: View {
    @State private var appeared = false
    @State private var gradientShift = false

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Image("ui_brand_tus")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 94, height: 94)
                    .shadow(color: Theme.primary.opacity(0.28), radius: 20, y: 9)
                    .scaleEffect(appeared ? 1 : 0.3)
                    .opacity(appeared ? 1 : 0)
            }
            Text("职场那些事")
                .font(.title)
                .bold()
                .foregroundStyle(Theme.textPrimary)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 8)
            ProgressView("正在恢复登录…")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .opacity(appeared ? 1 : 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            LinearGradient(
                colors: [Theme.bg, Theme.primary.opacity(0.16), Theme.secondary.opacity(0.13), Theme.bg],
                startPoint: gradientShift ? .topTrailing : .bottomLeading,
                endPoint: gradientShift ? .bottomLeading : .topTrailing
            )
            .ignoresSafeArea()
        }
        .onAppear {
            withAnimation(.spring(response: 0.55, dampingFraction: 0.65).delay(0.05)) {
                appeared = true
            }
            withAnimation(.easeInOut(duration: 2.4).repeatForever(autoreverses: true)) {
                gradientShift = true
            }
        }
    }
}

#Preview {
    LaunchView()
}
