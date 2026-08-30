import SwiftUI

/// 全页吐槽详情：统一加载一条吐槽与其评论，避免用半页弹窗承载内容阅读与互动。
struct ComplaintDetailView: View {
    @EnvironmentObject private var store: MockDataStore
    let complaintID: String
    var focusComments = false

    @State private var complaint: ComplaintModel?
    @State private var comments: [ComplaintComment] = []
    @State private var commentText = ""
    @State private var errorMessage: String?
    @FocusState private var commentFocused: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let complaint {
                        ComplaintCardView(complaint: complaint, allowDelete: complaint.userId == store.serverUserID)
                    } else if let errorMessage {
                        EmptyStateView(icon: "exclamationmark.triangle", title: "无法打开吐槽", message: errorMessage)
                    } else {
                        ProgressView().frame(maxWidth: .infinity).padding(.top, 80)
                    }

                    commentsSection
                        .id("comments")
                }
                .padding(16)
            }
            .background(Theme.bg)
            .navigationTitle("吐槽详情")
            .navigationBarTitleDisplayMode(.inline)
            .task { await reload() }
            .onAppear {
                guard focusComments else { return }
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                    withAnimation { proxy.scrollTo("comments", anchor: .bottom) }
                    commentFocused = true
                }
            }
        }
    }

    private var commentsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("全部评论 · \(comments.count)")
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            if comments.isEmpty {
                Text("还没有评论，来抢沙发～")
                    .font(.subheadline)
                    .foregroundStyle(Theme.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.vertical, 16)
            } else {
                ForEach(comments) { comment in
                    HStack(alignment: .top, spacing: 9) {
                        LittleEnergyAvatarView(
                            moodID: store.currentMoodID,
                            outfit: comment.userId == store.serverUserID ? store.currentUser.littleEnergyOutfit : .default,
                            size: 32
                        )
                        VStack(alignment: .leading, spacing: 3) {
                            Text(comment.authorName).font(.caption).bold()
                            Text(comment.content).font(.subheadline)
                            Text(Formatters.timeText(comment.time)).font(.caption2).foregroundStyle(Theme.textSecondary)
                        }
                    }
                }
            }
            HStack(spacing: 8) {
                TextField("说点什么…", text: $commentText, axis: .vertical)
                    .lineLimit(1...3)
                    .focused($commentFocused)
                    .padding(10)
                    .background(RoundedRectangle(cornerRadius: 14).fill(Theme.inputBg))
                Button("发送") { sendComment() }
                    .buttonStyle(.borderedProminent)
                    .tint(Theme.primary)
                    .disabled(commentText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.divider, lineWidth: 1))
    }

    private func reload() async {
        do {
            async let detail = APIClient.shared.fetchComplaint(id: complaintID)
            async let list = APIClient.shared.fetchComplaintComments(id: complaintID)
            complaint = try await detail
            comments = try await list
            errorMessage = nil
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? "请稍后重试"
        }
    }

    private func sendComment() {
        let content = commentText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        Task {
            guard let created = try? await APIClient.shared.postComplaintComment(id: complaintID, content: content) else { return }
            comments.append(created)
            commentText = ""
        }
    }
}
