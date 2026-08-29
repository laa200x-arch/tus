import SwiftUI

/// 我的（吐槽同事：档案 + 设置）
/// 头像 / 信用分 / 我的档案（同事·公司·吐槽）/ 聊天记录同步 / 退出登录
struct MineView: View {
    @EnvironmentObject private var store: MockDataStore
    @EnvironmentObject private var appState: AppState

    @State private var showEdit = false
    @State private var showProfile = false
    @State private var showCompanyList = false
    @State private var showMyStatuses = false
    @State private var showLogoutConfirm = false
    @State private var showAlert = false
    @State private var alertTitle = ""
    @State private var alertMessage = ""
    // v3：「更多」并入「我的」→ 同事档案 / AI 洞察 入口
    @State private var showColleagues = false
    @State private var showAI = false
    @State private var showMood = false
    @AppStorage("jiyu.syncHistory") private var syncHistory = true

    var body: some View {
        ScrollView {
            VStack(spacing: 14) {
                profileHeader
                archiveSection
                settingsSection
                toolsSection
            }
            .padding(16)
        }
        .background(Theme.bg)
        .navigationTitle("我的")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Menu {
                    Button("编辑资料") { showEdit = true }
                    Button("关于职场那些事") {
                        alertTitle = "关于职场那些事"
                        alertMessage = "记录职场里的千奇百怪，也记录自己的情绪变化。"
                        showAlert = true
                    }
                } label: {
                    UIAssetImage(.actionMore, size: 18, tint: Theme.textSecondary)
                }
            }
        }
        .sheet(isPresented: $showEdit) { ProfileEditView() }
        .sheet(isPresented: $showProfile) { NavigationStack { UserProfileView(user: store.currentUser) } }
        .sheet(isPresented: $showCompanyList) { CompanyListView() }
        .sheet(isPresented: $showMyStatuses) { MyComplaintsView() }
        .sheet(isPresented: $showColleagues) { NavigationStack { ColleagueTabView() } }
        .sheet(isPresented: $showAI) { NavigationStack { AITabView() } }
        .sheet(isPresented: $showMood) { MoodCheckinView() }
        .alert(alertTitle, isPresented: $showAlert) {
            Button("好的", role: .cancel) {}
        } message: {
            Text(alertMessage)
        }
        .confirmationDialog("退出当前账号？", isPresented: $showLogoutConfirm, titleVisibility: .visible) {
            Button("退出登录（\(store.currentUser.userName)）", role: .destructive) {
                appState.logout()
            }
            Button("取消", role: .cancel) {}
        } message: {
            Text("退出后将返回登录页，可选择其他账号登录")
        }
    }

    // MARK: - 头部

    private var profileHeader: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 14) {
                LittleEnergyAvatarView(
                    moodID: store.currentMoodID,
                    outfit: store.currentUser.littleEnergyOutfit,
                    size: 92
                )
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 6) {
                        Text(store.currentUser.userName)
                            .font(.title3)
                            .bold()
                            .foregroundStyle(Theme.textPrimary)
                        UIAssetImage(.badgeLevel, size: 22)
                    }
                    Text(store.currentUser.bio.isEmpty ? "@\(store.currentUser.userName)" : store.currentUser.bio)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
            }

            HStack(spacing: 10) {
                Button { showEdit = true } label: {
                    Label("编辑资料", systemImage: "pencil")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Theme.primary))
                }
                Button { showProfile = true } label: {
                    Label("查看主页", systemImage: "person")
                        .font(.subheadline)
                        .bold()
                        .foregroundStyle(Theme.primary)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Theme.primary, lineWidth: 1.2))
                }
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 18).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 18).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - 我的档案

    private var archiveSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("我的档案")
                .font(.subheadline)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                statTile("\(store.myComplaints.count)", "我的吐槽", asset: .profileComplaints, color: Theme.primaryDeep) { showMyStatuses = true }
                statTile("—", "我的收藏", asset: .profileFavorites, color: Theme.secondary) {
                    alertTitle = "我的收藏"
                    alertMessage = "收藏内容会在后续版本集中展示。"
                    showAlert = true
                }
                statTile("\(store.statuses.count)", "我的动态", asset: .profilePosts, color: Theme.primary) { showMyStatuses = true }
                statTile("30 天", "情绪记录", asset: .profileHistory, color: Theme.secondary) { showAI = true }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func statTile(_ value: String, _ title: String, asset: UIAsset, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
                UIAssetImage(asset, size: 28)
                Text(value)
                    .font(.title2)
                    .bold()
                    .foregroundStyle(color)
                Text(title)
                    .font(.caption2)
                    .foregroundStyle(Theme.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 12)
            .background(RoundedRectangle(cornerRadius: 12).fill(Theme.bg))
            .overlay(RoundedRectangle(cornerRadius: 12).stroke(Theme.divider, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 设置（聊天记录同步）

    private var settingsSection: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                UIAssetImage(.profileHistory, size: 22)
                VStack(alignment: .leading, spacing: 2) {
                    Text("聊天记录同步")
                        .font(.subheadline)
                        .foregroundStyle(Theme.textPrimary)
                    Text("不同设备登录同一账号可同步历史聊天；关闭后仅显示新消息")
                        .font(.caption2)
                        .foregroundStyle(Theme.textSecondary)
                }
                Spacer()
                Toggle("", isOn: $syncHistory)
                    .labelsHidden()
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 13)
        }
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    // MARK: - 工具

    private var toolsSection: some View {
        VStack(spacing: 0) {
            toolRow(asset: .toolReport, title: "情绪报告") { showAI = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .toolAI, title: "AI 洞察") { showAI = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .toolStress, title: "压力分析与打卡") { showMood = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .toolRelationship, title: "关系雷达") { showColleagues = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .rowColleague, title: "同事档案") { showColleagues = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .rowCompany, title: "公司属性管理") { showCompanyList = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .profileComplaints, title: "我的吐槽") { showMyStatuses = true }
            Divider().padding(.leading, 40)
            toolRow(asset: .brandTuS, title: "关于职场那些事") {
                alertTitle = "关于职场那些事"
                alertMessage = "职场那些事 —— 记录职场里的千奇百怪：甩锅、画饼、加班、PUA…… 四维标签（同事属性 / 公司属性 / 主题 / 软件）帮你把槽点记得清清楚楚。文明吐槽，不指名道姓，不人身攻击。"
                showAlert = true
            }
            Divider().padding(.leading, 40)
            toolRow(asset: .navProfile, title: "切换账号 / 退出登录") {
                showLogoutConfirm = true
            }
        }
        .padding(.horizontal, 14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func toolRow(asset: UIAsset, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                UIAssetImage(asset, size: 22)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                UIAssetImage(.actionChevron, size: 14, tint: Theme.textSecondary.opacity(0.6))
            }
            .padding(.vertical, 13)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        MineView()
            .environmentObject(MockDataStore.shared)
            .environmentObject(AppState())
    }
}
