import SwiftUI

/// 今日情绪打卡大卡：标题 + 五个快捷情绪 + 完整打卡入口
/// 快捷情绪直接调用现有打卡接口；成功后经全局状态即时更新顶部小能仔 / 统计卡 / 情绪卡
struct HomeMoodCard: View {
    @EnvironmentObject private var store: MockDataStore

    var onFullCheckin: () -> Void

    @State private var quickMoodFailed = false

    /// 五个快捷情绪：聚合快照优先，未就绪时回退默认五档（与共享 27 情绪目录稳定 ID 一致）
    private var quickMoods: [HomeQuickMood] {
        if let moods = store.homeOverview?.quickMoods, moods.count == 5 {
            return moods
        }
        return [
            HomeQuickMood(id: "xnz_motivated", label: "元气", assetName: "xnz_motivated"),
            HomeQuickMood(id: "xnz_composed", label: "还行", assetName: "xnz_composed"),
            HomeQuickMood(id: "xnz_calm", label: "一般", assetName: "xnz_calm"),
            HomeQuickMood(id: "xnz_tired", label: "好累", assetName: "xnz_tired"),
            HomeQuickMood(id: "xnz_angry", label: "想辞职", assetName: "xnz_angry")
        ]
    }

    private var checkedToday: Bool {
        store.homeOverview?.stats.moodCheckedToday ?? store.moodCheckedToday
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Label("今日情绪打卡", systemImage: "heart.text.square")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.homeNavy)
                Spacer()
                if checkedToday {
                    Button("修改") { onFullCheckin() }
                        .font(.caption)
                        .bold()
                        .foregroundStyle(Theme.primary)
                        .frame(minHeight: HomeMetrics.minTapTarget)
                }
            }

            if checkedToday, let checkin = store.moodToday {
                checkedContent(checkin)
            } else {
                Text("选一个今天的心情，坚持记录，AI 会生成你的职场情绪画像")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)

                quickMoodRow

                if quickMoodFailed {
                    Label("打卡失败，请重试", systemImage: "exclamationmark.triangle")
                        .font(.caption2)
                        .foregroundStyle(Theme.danger)
                }

                Button(action: onFullCheckin) {
                    Text("完整打卡（含压力源/备注）")
                        .font(.caption)
                        .bold()
                        .foregroundStyle(Theme.primary)
                        .frame(maxWidth: .infinity, minHeight: HomeMetrics.minTapTarget)
                        .background(Capsule().fill(Theme.primary.opacity(0.10)))
                }
                .buttonStyle(.plain)
            }
        }
        .modifier(HomeCardStyle())
    }

    private func checkedContent(_ checkin: MoodCheckin) -> some View {
        HStack(spacing: 14) {
            LittleEnergyAvatarView(
                moodID: LittleEnergyCatalog.normalizeMood(checkin.mood),
                outfit: store.currentUser.littleEnergyOutfit,
                size: 62
            )
            .shadow(color: Theme.primary.opacity(0.16), radius: 10, x: 0, y: 4)
            VStack(alignment: .leading, spacing: 4) {
                Text("今天已记录心情")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                if let sources = checkin.stressSources, !sources.isEmpty {
                    Text("压力源：" + sources.map { store.label(forStressSource: $0) }.joined(separator: "、"))
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(2)
                } else {
                    Text("坚持记录，AI 会生成你的职场情绪画像")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            Spacer()
        }
    }

    private var quickMoodRow: some View {
        HStack(spacing: 10) {
            ForEach(quickMoods) { mood in
                Button {
                    quickCheckin(moodID: mood.id)
                } label: {
                    VStack(spacing: 3) {
                        LittleEnergyAvatarView(
                            moodID: mood.id,
                            outfit: store.currentUser.littleEnergyOutfit,
                            size: 34
                        )
                        Text(mood.label)
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.7)
                    }
                    .frame(maxWidth: .infinity, minHeight: 64)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color.white.opacity(0.7))
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .stroke(Theme.divider, lineWidth: 1)
                    )
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func quickCheckin(moodID: String) {
        quickMoodFailed = false
        Task {
            let ok = await store.checkinMood(mood: moodID, stressSources: [], note: "")
            if !ok { quickMoodFailed = true }
        }
    }
}
