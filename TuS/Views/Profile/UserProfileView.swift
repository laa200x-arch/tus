import SwiftUI

/// 用户资料页（通用：查看某位 App 用户）
/// 展示：头像 / 昵称 / 信用 / 认证 / 简介 / 位置
/// 操作：私信沟通（一键进入聊天）
struct UserProfileView: View {
    @EnvironmentObject private var store: MockDataStore
    let initialUser: UserModel
    @State private var user: UserModel

    init(user: UserModel) {
        self.initialUser = user
        _user = State(initialValue: user)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                profileCard

                if user.id != store.currentUser.id {
                    NavigationLink {
                        ChatDetailView(partner: user)
                    } label: {
                        Text("私信沟通")
                            .font(.headline)
                            .foregroundStyle(Theme.primary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 13)
                            .background(Capsule().fill(Theme.cardBg))
                            .overlay(Capsule().stroke(Theme.primary, lineWidth: 1))
                    }
                }
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle(user.userName)
        .navigationBarTitleDisplayMode(.inline)
        .refreshable {
            if store.isServerMode {
                user = await store.refreshUser(user)
            }
        }
        .task {
            if store.isServerMode {
                user = await store.refreshUser(user)
            }
        }
    }

    private var profileCard: some View {
        HStack(spacing: 14) {
            LittleEnergyAvatarView(
                moodID: user.id == store.currentUser.id ? store.currentMoodID : LittleEnergyCatalog.defaultMoodID,
                outfit: user.littleEnergyOutfit,
                size: 76
            )
            AvatarView(user: user, size: 64)
            VStack(alignment: .leading, spacing: 6) {
                HStack(spacing: 6) {
                    Text(user.userName)
                        .font(.title3)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                }
                if !user.bio.isEmpty {
                    Text(user.bio)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                }
                HStack(spacing: 8) {
                    CreditBadgeView(score: user.creditScore)
                    if user.verification != .none {
                        Label(user.verification.rawValue, systemImage: "checkmark.seal.fill")
                            .font(.caption2)
                            .foregroundStyle(Theme.primary)
                    }
                }
            }
            Spacer()
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }
}

#Preview {
    NavigationStack {
        UserProfileView(user: MockDataStore.shared.currentUser)
            .environmentObject(MockDataStore.shared)
    }
}
