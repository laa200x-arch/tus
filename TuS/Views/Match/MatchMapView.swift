import SwiftUI

/// AI 洞察（Tab）：职场人格 + 情绪趋势 + AI 情绪总结 + 人际洞察
struct AITabView: View {
    @EnvironmentObject private var store: MockDataStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                header
                personalityCard
                moodTrendCard
                moodSummaryCard
                relationshipSection
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
        }
        .background(Theme.bg)
        .navigationTitle("AI 洞察")
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            if store.isServerMode {
                await store.loadPersonality()
                await store.refreshMood()
                await store.loadMoodSummary()
            }
        }
        .task {
            if store.isServerMode {
                await store.loadPersonality()
                await store.refreshMood()
                await store.loadMoodSummary()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("AI 洞察 · 职场体检报告")
                .font(.title2)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            Text("基于你的吐槽记录与打卡数据生成，越使用越准确。")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
        }
        .padding(.top, 4)
    }

    // MARK: - 职场人格

    private var personalityCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                UIAssetImage(.messageAI, size: 22)
                Text("职场人格")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
            }
            if let profile = store.personality {
                HStack(spacing: 14) {
                    LittleEnergyAvatarView(
                        moodID: store.currentMoodID,
                        outfit: store.currentUser.littleEnergyOutfit,
                        size: 64
                    )
                    VStack(alignment: .leading, spacing: 4) {
                        Text(profile.personality)
                            .font(.title3)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        Text(profile.desc)
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                }
                personalityStats(profile.stats)
                Text(profile.disclaimer)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            } else {
                Text(store.isServerMode
                     ? "吐槽几条后，AI 会为你生成职场人格画像"
                     : "登录后解锁 AI 职场人格")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 20)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func personalityStats(_ stats: PersonalityStats) -> some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
            statLine("吐槽总数", "\(stats.totalComplaints) 条")
            statLine("获得共鸣", "\(stats.totalResonances) 次")
            statLine("最常吐槽对象", stats.topTarget?.isEmpty == false ? stats.topTarget! : "暂无")
            statLine("最常吐槽主题", stats.topTheme?.isEmpty == false ? stats.topTheme! : "暂无")
            statLine("情绪指数", "\(stats.emotionIndex)")
            statLine("关系敏感度", "\(stats.relationshipSensitivity)")
            statLine("摸鱼指数", "\(stats.slackScore)")
            statLine("最脆弱点", stats.weakestPoint?.isEmpty == false ? stats.weakestPoint! : "暂无")
        }
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.inputBg))
    }

    private func statLine(_ title: String, _ value: String) -> some View {
        HStack {
            Text(title)
                .font(.caption2)
                .foregroundStyle(Theme.textSecondary)
            Spacer()
            Text(value)
                .font(.caption2)
                .bold()
                .foregroundStyle(Theme.textPrimary)
        }
    }

    // MARK: - 情绪趋势

    private var moodTrendCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                UIAssetImage(.toolStress, size: 22)
                Text("最近 30 天情绪曲线")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                if store.moodCheckedToday, let mood = store.moodToday?.mood {
                    Text("今日：\(mood)")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            if store.moodTrend.isEmpty {
                Text(store.isServerMode
                     ? "每天打卡一次，30 天后就能看到你的情绪曲线"
                     : "登录并打卡后生成情绪曲线")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 5) {
                        ForEach(store.moodTrend) { point in
                            VStack(spacing: 3) {
                                Text(point.mood ?? "")
                                    .font(.caption)
                                RoundedRectangle(cornerRadius: 3)
                                    .fill(point.mood != nil ? Theme.primary.opacity(0.7) : Theme.divider)
                                    .frame(width: 14, height: 40)
                                Text(String(point.date.suffix(2)))
                                    .font(.system(size: 8))
                                    .foregroundStyle(Theme.textSecondary)
                            }
                        }
                    }
                }
                let checked = store.moodTrend.filter { $0.mood != nil }.count
                Text("已打卡 \(checked)/\(store.moodTrend.count) 天")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - AI 情绪总结

    private var moodSummaryCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                UIAssetImage(.toolAI, size: 22)
                Text("AI 情绪总结")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
            }
            if let summary = store.moodSummary {
                Text(summary.message)
                    .font(.caption)
                    .foregroundStyle(Theme.textPrimary)
                if !summary.rankings.isEmpty {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("压力来源 TOP \(summary.rankings.count)")
                            .font(.caption2)
                            .bold()
                            .foregroundStyle(Theme.textSecondary)
                        ForEach(Array(summary.rankings.enumerated()), id: \.element.id) { index, ranking in
                            HStack {
                                Text("\(index + 1). \(store.label(forStressSource: ranking.id))")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textPrimary)
                                Spacer()
                                Text("\(ranking.count) 次")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.secondary)
                            }
                        }
                    }
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.inputBg))
                }
                if !summary.hotWeekdays.isEmpty {
                    Label("情绪低谷日：\(summary.hotWeekdays.joined(separator: "、"))",
                          systemImage: "calendar.badge.exclamationmark")
                        .font(.caption2)
                        .foregroundStyle(Theme.warning)
                }
                ForEach(Array(summary.insights.enumerated()), id: \.offset) { _, insight in
                    Label(insight, systemImage: "lightbulb")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            } else {
                Text(store.isServerMode
                     ? "暂无足够数据，开始每天打卡，AI 会在一周后给出你的职场情绪画像"
                     : "登录并打卡后生成 AI 情绪总结")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - 人际洞察

    private var relationshipSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 6) {
                UIAssetImage(.toolRelationship, size: 22)
                Text("人际洞察")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
            }
            if store.colleagues.isEmpty {
                Text("先去「同事属性」添加同事档案，AI 才能帮你分析关系")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
            } else {
                ForEach(store.colleagues) { colleague in
                    NavigationLink {
                        AIRelationshipView(colleague: colleague)
                    } label: {
                        HStack(spacing: 10) {
                            LittleEnergyAvatarView(role: .darkColleague, size: 42)
                            VStack(alignment: .leading, spacing: 2) {
                                Text(colleague.name)
                                    .font(.subheadline)
                                    .bold()
                                    .foregroundStyle(Theme.textPrimary)
                                Text([
                                    colleague.relation,
                                    colleague.position
                                ].filter { !$0.isEmpty }.joined(separator: " · "))
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textSecondary)
                            }
                            Spacer()
                            Image(systemName: "sparkles")
                                .font(.caption)
                                .foregroundStyle(Theme.primary)
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundStyle(Theme.textSecondary.opacity(0.6))
                        }
                        .padding(12)
                        .background(RoundedRectangle(cornerRadius: 14).fill(Theme.cardBg))
                        .overlay(RoundedRectangle(cornerRadius: 14).stroke(Theme.divider, lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }
}

/// AI 同事关系解读（单同事）
struct AIRelationshipView: View {
    @EnvironmentObject private var store: MockDataStore
    let colleague: ColleagueModel

    @State private var summary: RelationshipSummary?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                if let summary {
                    headerCard(summary)
                    RadarChartView(scores: summary.radar, legend: "雷达评分（满分 100）")
                    infoCard(title: "关系类型", icon: "tag", tint: Theme.primary) {
                        Text(summary.relationType)
                            .font(.subheadline)
                            .bold()
                            .foregroundStyle(Theme.primary)
                    }
                    infoCard(title: "关键矛盾", icon: "bolt.fill", tint: Theme.danger) {
                        ForEach(summary.conflicts, id: \.self) { c in
                            Label(c, systemImage: "circle.fill")
                                .font(.caption2)
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                    infoCard(title: "高频行为", icon: "repeat", tint: Theme.secondary) {
                        if summary.topBehaviors.isEmpty {
                            Text("暂无记录")
                                .font(.caption2)
                                .foregroundStyle(Theme.textSecondary)
                        } else {
                            ForEach(summary.topBehaviors, id: \.self) { b in
                                Label(store.label(forBehaviorTag: b), systemImage: "circle.fill")
                                    .font(.caption2)
                                    .foregroundStyle(Theme.textPrimary)
                            }
                        }
                    }
                    infoCard(title: "AI 建议", icon: "lightbulb", tint: Theme.success) {
                        ForEach(summary.suggestions, id: \.self) { s in
                            Label(s, systemImage: "checkmark.circle")
                                .font(.caption2)
                                .foregroundStyle(Theme.textPrimary)
                        }
                    }
                    Text("基于你的 \(summary.baseOn) 条吐槽记录生成 · \(summary.disclaimer)")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                } else {
                    VStack(spacing: 10) {
                        ProgressView()
                        Text(store.isServerMode ? "AI 正在解读…" : "登录后可用 AI 关系解读")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 80)
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("AI 关系解读")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if summary == nil, let serverID = colleague.id.serverIDString {
                summary = await store.relationshipSummary(colleagueId: serverID)
            }
        }
    }

    private func headerCard(_ summary: RelationshipSummary) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 12) {
                LittleEnergyAvatarView(role: .darkColleague, size: 54)
                VStack(alignment: .leading, spacing: 3) {
                    Text(summary.colleagueName)
                        .font(.title3)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                    Text([summary.position, summary.relation].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                VStack(spacing: 2) {
                    Text("\(summary.healthScore)")
                        .font(.title2)
                        .bold()
                        .foregroundStyle(summary.healthScore >= 70 ? Theme.success : (summary.healthScore >= 50 ? Theme.warning : Theme.danger))
                    Text("关系健康度")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func infoCard<Content: View>(title: String, icon: String, tint: Color,
                                         @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(title, systemImage: icon)
                .font(.subheadline)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            VStack(alignment: .leading, spacing: 6) {
                content()
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }
}

/// 五维关系雷达图（Canvas 绘制：协作 / 专业 / 沟通 / 支持 / 信任）
struct RadarChartView: View {
    let scores: RadarMap
    var legend: String = ""

    private var dimensions: [(String, Double)] {
        [
            ("协作", Double(scores.cooperation)),
            ("专业", Double(scores.expertise)),
            ("沟通", Double(scores.communication)),
            ("支持", Double(scores.support)),
            ("信任", Double(scores.trust))
        ]
    }

    var body: some View {
        VStack(spacing: 10) {
            Canvas { context, canvasSize in
                let center = CGPoint(x: canvasSize.width / 2, y: canvasSize.height / 2)
                let radius = min(canvasSize.width, canvasSize.height) / 2 - 14
                let count = dimensions.count

                func point(index: Int, value: Double) -> CGPoint {
                    // 从正上方开始，顺时针分布
                    let angle = -Double.pi / 2 + Double(index) * (2 * Double.pi / Double(count))
                    return CGPoint(
                        x: center.x + CGFloat(cos(angle)) * radius * CGFloat(value / 100),
                        y: center.y + CGFloat(sin(angle)) * radius * CGFloat(value / 100)
                    )
                }

                // 网格（4 层）
                for level in stride(from: 0.25, through: 1.0, by: 0.25) {
                    var grid = Path()
                    for i in 0...count {
                        let p = point(index: i % count, value: level * 100)
                        if i == 0 { grid.move(to: p) } else { grid.addLine(to: p) }
                    }
                    context.stroke(grid, with: .color(Theme.divider), lineWidth: 1)
                }

                // 轴线
                for i in 0..<count {
                    var axis = Path()
                    axis.move(to: center)
                    axis.addLine(to: point(index: i, value: 100))
                    context.stroke(axis, with: .color(Theme.divider), lineWidth: 1)
                }

                // 数据多边形
                var shape = Path()
                for i in 0...count {
                    let dim = dimensions[i % count]
                    let p = point(index: i % count, value: dim.1)
                    if i == 0 { shape.move(to: p) } else { shape.addLine(to: p) }
                }
                context.fill(shape, with: .color(Theme.primary.opacity(0.22)))
                context.stroke(shape, with: .color(Theme.primary), lineWidth: 2)
            }
            .frame(width: 200, height: 200)

            // 图例（维度 + 分值）
            HStack(spacing: 12) {
                ForEach(Array(dimensions.enumerated()), id: \.offset) { _, dim in
                    VStack(spacing: 2) {
                        Text(dim.0)
                            .font(.caption2)
                            .foregroundStyle(Theme.textSecondary)
                        Text("\(Int(dim.1))")
                            .font(.caption)
                            .bold()
                            .foregroundStyle(Theme.primary)
                    }
                }
            }
            if !legend.isEmpty {
                Text(legend)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }
}

#Preview {
    NavigationStack {
        AITabView()
            .environmentObject(MockDataStore.shared)
    }
}
