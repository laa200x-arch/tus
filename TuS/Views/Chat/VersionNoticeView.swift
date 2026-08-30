import SwiftUI
import UIKit

/// 更新信息由用户在「消息 → 版本通知」主动打开，不在启动时打断当前操作。
struct VersionNoticeView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var version: ServerVersion?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 14) {
                    UIAssetImage(.messageUpdate, size: 50)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(version.map { "职场那些事 v\($0.current)" } ?? "版本通知")
                            .font(.headline)
                            .foregroundStyle(Theme.textPrimary)
                        Text(version?.updateMessage ?? "正在获取最新版本信息…")
                            .font(.subheadline)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardBg))

                if let download = version?.downloadUrl, let url = URL(string: download) {
                    Button("查看下载") { UIApplication.shared.open(url) }
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Capsule().fill(Theme.primary))
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("版本通知")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .cancellationAction) {
                Button("关闭") { dismiss() }
            }
        }
        .task { version = try? await APIClient.shared.fetchVersion() }
    }
}
