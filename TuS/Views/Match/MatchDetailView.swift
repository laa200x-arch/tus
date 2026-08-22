import SwiftUI

/// 发布吐槽（职场关系操作系统 v2）
/// 内容 + AI 自动识别提示 + 关联同事 + 同事类型 + 行为标签 + 情绪倾向 + 匿名
struct ComplaintComposeView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var content = ""
    @State private var colleagueId: String? = nil
    @State private var category: String? = nil
    @State private var behaviorTags: Set<String> = []
    @State private var sentiment: String? = nil
    @State private var isAnonymous = false
    @State private var aiExtracted: AIExtracted?
    @State private var aiChecking = false
    @State private var showAlert = false
    @State private var alertMessage = ""
    @State private var submitting = false
    /// AI 识别防抖任务
    @State private var aiTask: Task<Void, Never>?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    composeEditor
                    aiHint
                    colleaguePicker
                    categorySection
                    behaviorSection
                    sentimentSection
                    anonymousSection
                    warning
                    publishButton
                    Spacer()
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("发吐槽")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .alert("发布失败", isPresented: $showAlert) {
                Button("好的", role: .cancel) {}
            } message: {
                Text(alertMessage)
            }
        }
    }

    // MARK: - 内容输入 + AI 识别

    private var composeEditor: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("吐槽内容")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary)
                Spacer()
                Text("\(content.count)/1000")
                    .font(.caption2)
                    .foregroundStyle(content.count > 1000 ? Theme.danger : Theme.textSecondary)
            }
            TextEditor(text: $content)
                .frame(minHeight: 130)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.divider, lineWidth: 1))
                .onChange(of: content) { newValue in
                    scheduleAIExtract(text: newValue)
                }
        }
    }

    /// 输入停顿 0.6s 后触发 AI 识别
    private func scheduleAIExtract(text: String) {
        aiTask?.cancel()
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            aiExtracted = nil
            aiChecking = false
            return
        }
        aiChecking = true
        aiTask = Task {
            try? await Task.sleep(nanoseconds: 600_000_000)
            guard !Task.isCancelled else { return }
            let extracted = await store.extractTags(text: trimmed)
            guard !Task.isCancelled else { return }
            aiExtracted = extracted
            aiChecking = false
            // AI 结果自动预填（未手动选择时）
            if let extracted {
                if category == nil { category = extracted.category }
                if let tags = extracted.behaviorTags {
                    for t in tags { behaviorTags.insert(t) }
                }
                if sentiment == nil { sentiment = extracted.sentiment }
            }
        }
    }

    private var aiHint: some View {
        Group {
            if aiChecking {
                Label("AI 正在识别这条吐槽…", systemImage: "sparkles")
                    .font(.caption)
                    .foregroundStyle(Theme.primary)
            } else if let extracted = aiExtracted,
                      extracted.category != nil || !(extracted.behaviorTags ?? []).isEmpty || extracted.sentiment != nil {
                VStack(alignment: .leading, spacing: 4) {
                    Label("AI 识别结果（已自动填入，可修改）", systemImage: "sparkles")
                        .font(.caption)
                        .bold()
                        .foregroundStyle(Theme.primary)
                    Text(aiHintText(extracted))
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(Theme.primary.opacity(0.06)))
    }

    private func aiHintText(_ extracted: AIExtracted) -> String {
        var parts: [String] = []
        if let c = extracted.category { parts.append(store.label(forColleagueType: c)) }
        if let tags = extracted.behaviorTags, !tags.isEmpty {
            parts.append(tags.map { store.label(forBehaviorTag: $0) }.joined(separator: "、"))
        }
        if let s = extracted.sentiment { parts.append("情绪：" + store.label(forSentiment: s)) }
        return parts.joined(separator: " · ")
    }

    // MARK: - 关联同事

    private var colleaguePicker: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("关联同事（可选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            Picker("关联同事", selection: $colleagueId) {
                Text("不指定").tag(String?.none)
                ForEach(store.colleagues) { colleague in
                    Text(colleague.name).tag(String?.some(colleague.id.serverIDString ?? colleague.id.uuidString))
                }
            }
            .pickerStyle(.menu)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Theme.divider, lineWidth: 1))
        }
    }

    // MARK: - 同事类型（单选）

    private var categorySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("同事类型（单选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
                optionChip("不指定", active: category == nil) { category = nil }
                ForEach(store.tagDict.colleagueTypes) { type in
                    optionChip(type.emoji.map { "\($0) \(type.label)" } ?? type.label,
                               active: category == type.id) {
                        category = (category == type.id) ? nil : type.id
                    }
                }
            }
        }
    }

    // MARK: - 行为标签（多选）

    private var behaviorSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("行为标签（多选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), spacing: 8)], spacing: 8) {
                ForEach(store.tagDict.behaviorTags) { tag in
                    optionChip(tag.label, active: behaviorTags.contains(tag.id)) {
                        if behaviorTags.contains(tag.id) { behaviorTags.remove(tag.id) }
                        else { behaviorTags.insert(tag.id) }
                    }
                }
            }
        }
    }

    // MARK: - 情绪倾向（单选）

    private var sentimentSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("情绪倾向（单选）")
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    optionChip("不指定", active: sentiment == nil) { sentiment = nil }
                    ForEach(store.tagDict.moods) { m in
                        optionChip("\(m.emoji) \(m.label)", active: sentiment == m.id) {
                            sentiment = (sentiment == m.id) ? nil : m.id
                        }
                    }
                }
            }
        }
    }

    private func optionChip(_ title: String, active: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption2)
                .lineLimit(1)
                .foregroundStyle(active ? .white : Theme.textPrimary)
                .frame(maxWidth: .infinity)
                .padding(.horizontal, 6)
                .padding(.vertical, 6)
                .background(Capsule().fill(active ? Theme.primary : Theme.cardBg))
                .overlay(Capsule().stroke(Theme.divider, lineWidth: active ? 0 : 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 匿名

    private var anonymousSection: some View {
        Toggle(isOn: $isAnonymous) {
            VStack(alignment: .leading, spacing: 2) {
                Text("匿名发布")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
                Text("开启后广场中显示为「匿名用户」")
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .tint(Theme.primary)
        .padding(12)
        .background(RoundedRectangle(cornerRadius: 12).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: 1))
    }

    private var warning: some View {
        Label("文明吐槽，禁止人身攻击与泄露隐私；内容将自动经过平台风控审核",
              systemImage: "exclamationmark.shield.fill")
            .font(.caption2)
            .foregroundStyle(Theme.warning)
    }

    private var canPublish: Bool {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        return !text.isEmpty && text.count <= 1000 && !submitting
    }

    private var publishButton: some View {
        Button {
            publish()
        } label: {
            Text(submitting ? "发布中…" : "发布")
                .font(.headline)
                .foregroundStyle(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Capsule().fill(canPublish ? Theme.primary : Theme.primary.opacity(0.4)))
        }
        .disabled(!canPublish)
    }

    private func publish() {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, text.count <= 1000 else { return }
        submitting = true
        Task {
            let result = await store.postComplaint(
                content: text,
                colleagueId: colleagueId,
                category: category,
                behaviorTags: Array(behaviorTags),
                sentiment: sentiment,
                isAnonymous: isAnonymous,
                aiExtracted: aiExtracted
            )
            submitting = false
            switch result {
            case .blocked(let warning), .failed(let warning):
                alertMessage = warning
                showAlert = true
            case .sent:
                dismiss()
            }
        }
    }
}

#Preview {
    ComplaintComposeView()
        .environmentObject(MockDataStore.shared)
}
