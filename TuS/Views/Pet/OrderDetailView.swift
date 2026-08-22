import SwiftUI

/// 同事档案详情（同事属性核心页 · v2 增强）
/// 属性、关联公司、备注 + 关系雷达打分 + AI 关系解读入口；支持编辑与删除
struct ColleagueDetailView: View {
    @EnvironmentObject private var store: MockDataStore
    let colleague: ColleagueModel

    @State private var showEdit = false
    @State private var showDeleteConfirm = false
    // 雷达编辑状态
    @State private var radarScores: RadarMap?
    @State private var savingRadar = false
    // v3：聊天记录分析
    @State private var showChatAnalysis = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                headerCard
                if !colleague.attributeTags.isEmpty {
                    attributeSection
                }
                if !colleague.notes.isEmpty {
                    notesSection
                }
                radarSection
                aiEntrySection
                chatAnalysisSection
                actions
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle(colleague.name)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showEdit) {
            ColleagueEditView(editing: colleague)
        }
        .sheet(isPresented: $showChatAnalysis) {
            ChatAnalysisView()
        }
        .confirmationDialog("删除该同事档案？", isPresented: $showDeleteConfirm, titleVisibility: .visible) {
            Button("删除", role: .destructive) {
                Task { await store.deleteColleague(id: colleague.id) }
            }
            Button("取消", role: .cancel) {}
        }
        .onAppear {
            if radarScores == nil {
                radarScores = store.radar(for: colleague)
            }
        }
        .task {
            if store.isServerMode, let serverID = colleague.id.serverIDString,
               let (scored, scores) = try? await APIClient.shared.getRadar(colleagueId: serverID) {
                if radarScores == nil || !scored {
                    radarScores = scores
                }
            }
        }
    }

    private var headerCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                SymbolAvatar(symbol: colleague.avatarSymbol, size: 56)
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(colleague.name)
                            .font(.title3)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        if !colleague.relation.isEmpty {
                            Text(colleague.relation)
                                .font(.caption2)
                                .foregroundStyle(.white)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Capsule().fill(Theme.secondary))
                        }
                    }
                    Text([
                        colleague.position,
                        colleague.department
                    ].filter { !$0.isEmpty }.joined(separator: " · "))
                        .font(.subheadline)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
            if let companyName = colleague.companyName, !companyName.isEmpty {
                HStack(spacing: 6) {
                    Image(systemName: "building.2.fill")
                        .font(.caption)
                        .foregroundStyle(Theme.primary)
                    Text(companyName)
                        .font(.caption)
                        .foregroundStyle(Theme.textPrimary)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.divider, lineWidth: 1))
    }

    private var attributeSection: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("属性标签")
                .font(.subheadline)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 76), spacing: 8)], spacing: 8) {
                ForEach(colleague.attributeTags, id: \.self) { tag in
                    Text(tag)
                        .font(.caption2)
                        .foregroundStyle(Theme.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Theme.primary.opacity(0.10)))
                }
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private var notesSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("备注")
                .font(.subheadline)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            Text(colleague.notes)
                .font(.subheadline)
                .foregroundStyle(Theme.textPrimary)
                .lineSpacing(4)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - 关系雷达（v2）

    private var radarSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                Image(systemName: "chart.polygon")
                    .foregroundStyle(Theme.primary)
                Text("关系雷达")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Text("拖动滑块打分（0-100）")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
            if let scores = radarScores {
                RadarChartView(scores: scores)
                sliderRow("协作", value: binding(\.cooperation))
                sliderRow("专业", value: binding(\.expertise))
                sliderRow("沟通", value: binding(\.communication))
                sliderRow("支持", value: binding(\.support))
                sliderRow("信任", value: binding(\.trust))
                Button {
                    saveRadar(scores)
                } label: {
                    Text(savingRadar ? "保存中…" : "保存打分")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(savingRadar ? Theme.primary.opacity(0.4) : Theme.primary))
                }
                .disabled(savingRadar)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func binding(_ keyPath: WritableKeyPath<RadarMap, Int>) -> Binding<Double> {
        Binding<Double>(
            get: { Double(radarScores?[keyPath: keyPath] ?? 60) },
            set: { radarScores?[keyPath: keyPath] = Int($0) }
        )
    }

    private func sliderRow(_ title: String, value: Binding<Double>) -> some View {
        HStack(spacing: 10) {
            Text(title)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 32, alignment: .leading)
            Slider(value: value, in: 0...100, step: 1)
                .tint(Theme.primary)
            Text("\(Int(value.wrappedValue))")
                .font(.caption)
                .bold()
                .foregroundStyle(Theme.primary)
                .frame(width: 30, alignment: .trailing)
        }
    }

    private func saveRadar(_ scores: RadarMap) {
        guard let serverID = colleague.id.serverIDString else {
            // 演示模式：本地保存
            radarScores = scores
            store.radarByColleague[colleague.id.uuidString] = scores
            return
        }
        savingRadar = true
        Task {
            let ok = await store.saveRadar(colleagueId: serverID, scores: scores)
            savingRadar = false
            if !ok {
                radarScores = store.radar(for: colleague)
            }
        }
    }

    // MARK: - AI 关系解读入口（v2）

    private var aiEntrySection: some View {
        NavigationLink {
            AIRelationshipView(colleague: colleague)
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "sparkles")
                    .font(.title3)
                    .foregroundStyle(Theme.primary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.primary.opacity(0.12)))
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI 关系解读")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                    Text("基于吐槽记录与雷达评分，生成关系健康度与建议")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary.opacity(0.6))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.primary.opacity(0.35), lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // v3：聊天记录分析入口
    private var chatAnalysisSection: some View {
        Button {
            showChatAnalysis = true
        } label: {
            HStack(spacing: 12) {
                Image(systemName: "text.bubble")
                    .font(.title3)
                    .foregroundStyle(Theme.secondary)
                    .frame(width: 36, height: 36)
                    .background(Circle().fill(Theme.secondary.opacity(0.12)))
                VStack(alignment: .leading, spacing: 2) {
                    Text("聊天记录分析")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                    Text("粘贴聊天记录，AI 分析沟通模式与建议")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary.opacity(0.6))
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
            .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    private var actions: some View {
        HStack(spacing: 12) {
            Button {
                showEdit = true
            } label: {
                Label("编辑", systemImage: "pencil")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(Theme.primary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(Capsule().stroke(Theme.primary, lineWidth: 1.2))
            }
            Button(role: .destructive) {
                showDeleteConfirm = true
            } label: {
                Label("删除", systemImage: "trash")
                    .font(.subheadline)
                    .bold()
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 11)
                    .background(Capsule().fill(Theme.danger))
            }
        }
    }
}

#Preview {
    NavigationStack {
        ColleagueDetailView(colleague: MockDataStore.shared.colleagues.first ?? ColleagueModel(name: "示例同事"))
            .environmentObject(MockDataStore.shared)
    }
}

// MARK: - v3 聊天记录分析（写在同一文件，遵守"不增删 swift 文件"约束）

/// 聊天记录分析：粘贴文本 → AI 统计 / 情绪分布 / 沟通模式 / 建议
struct ChatAnalysisView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var result: ChatAnalysis?
    @State private var loading = false
    @State private var errorMsg = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("粘贴你与该同事的聊天记录（每行一条消息）")
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                    TextEditor(text: $text)
                        .frame(height: 140)
                        .padding(8)
                        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.cardBg))
                        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: 1))
                    HStack {
                        Button("填入示例") {
                            text = "你马上把这个改一下\n好，我看下\n你怎么又搞不定？\n这个不关我事\n今晚必须给我\n收到，辛苦了"
                        }
                        .font(.footnote)
                        Spacer()
                        Button(action: run) {
                            if loading { ProgressView().tint(.white) }
                            else { Text("开始分析") }
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Theme.primary)
                        .disabled(loading || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    }
                    if let result {
                        resultView(result)
                    }
                    if !errorMsg.isEmpty {
                        Text(errorMsg).font(.footnote).foregroundStyle(.red)
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("聊天记录分析")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("关闭") { dismiss() }
                }
            }
        }
    }

    private func run() {
        loading = true
        errorMsg = ""
        Task {
            do {
                let r = try await APIClient.shared.analyzeChat(text: text)
                await MainActor.run { result = r; loading = false }
            } catch {
                await MainActor.run { errorMsg = "分析失败：" + error.localizedDescription; loading = false }
            }
        }
    }

    private func resultView(_ r: ChatAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("共 \(r.total) 条消息" + (r.avgReplyHours.map { " · 平均回复 \($0) 小时" } ?? ""))
                .font(.footnote)
                .foregroundStyle(Theme.textSecondary)
            HStack(spacing: 0) {
                colorBlock(.green, CGFloat(r.sentiment.positive) / 100, "积极 \(r.sentiment.positive)%")
                colorBlock(Theme.primary, CGFloat(r.sentiment.neutral) / 100, "中性 \(r.sentiment.neutral)%")
                colorBlock(.red, CGFloat(r.sentiment.negative) / 100, "消极 \(r.sentiment.negative)%")
            }
            .frame(height: 22)
            .clipShape(Capsule())
            let patterns = r.patterns.filter { $0.key != "balanced" }
            if !patterns.isEmpty {
                Text("沟通模式").font(.subheadline).bold()
                ForEach(patterns, id: \.key) { p in
                    Text("• \(p.label)（\(p.count) 条，占 \(p.ratio)%）")
                        .font(.footnote)
                        .foregroundStyle(Theme.textPrimary)
                }
            }
            Text("建议").font(.subheadline).bold()
            ForEach(Array(r.suggestions.enumerated()), id: \.offset) { _, s in
                Text("💡 \(s)").font(.footnote).foregroundStyle(Theme.textPrimary)
            }
            Text(r.disclaimer).font(.caption2).foregroundStyle(Theme.textSecondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func colorBlock(_ color: Color, _ ratio: CGFloat, _ label: String) -> some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(color)
                Text(label)
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity)
            }
            .frame(width: max(geo.size.width * ratio, 24))
        }
    }
}
