import SwiftUI
import PhotosUI

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
    @State private var avatarItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    // v3：「更多」并入「我的」→ 同事档案 / AI 洞察 入口
    @State private var showColleagues = false
    @State private var showAI = false
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
        .sheet(isPresented: $showEdit) { ProfileEditView() }
        .sheet(isPresented: $showProfile) { NavigationStack { UserProfileView(user: store.currentUser) } }
        .sheet(isPresented: $showCompanyList) { CompanyListView() }
        .sheet(isPresented: $showMyStatuses) { MyComplaintsView() }
        .sheet(isPresented: $showColleagues) { NavigationStack { ColleagueTabView() } }
        .sheet(isPresented: $showAI) { NavigationStack { AITabView() } }
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
                    size: 82
                )
                ZStack(alignment: .bottomTrailing) {
                    AvatarView(user: store.currentUser, size: 62)
                    PhotosPicker(selection: $avatarItem, matching: .images) {
                        if isUploadingAvatar {
                            ProgressView()
                                .frame(width: 24, height: 24)
                        } else {
                            Image(systemName: "camera.fill")
                                .font(.system(size: 10))
                                .foregroundStyle(.white)
                                .frame(width: 24, height: 24)
                                .background(Circle().fill(Theme.primary))
                        }
                    }
                    .disabled(isUploadingAvatar)
                }
                VStack(alignment: .leading, spacing: 5) {
                    Text(store.currentUser.userName)
                        .font(.title3)
                        .bold()
                        .foregroundStyle(Theme.textPrimary)
                    Text(store.currentUser.bio.isEmpty ? "@\(store.currentUser.userName)" : store.currentUser.bio)
                        .font(.caption)
                        .foregroundStyle(Theme.textSecondary)
                        .lineLimit(1)
                }
                Spacer()
                creditRing
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
        .onChange(of: avatarItem) { _ in
            handleAvatarSelection()
        }
    }

    /// 相册选择头像 → 压缩上传 → 更新资料
    private func handleAvatarSelection() {
        guard let avatarItem else { return }
        Task {
            isUploadingAvatar = true
            defer {
                isUploadingAvatar = false
                self.avatarItem = nil
            }
            guard let data = try? await avatarItem.loadTransferable(type: Data.self),
                  let image = UIImage(data: data),
                  let jpeg = downscaledJPEG(image) else {
                alertTitle = "提示"
                alertMessage = "头像读取失败，请重试"
                showAlert = true
                return
            }
            guard jpeg.count <= 1024 * 1024 else {
                alertTitle = "提示"
                alertMessage = "头像过大（压缩后仍超过 1MB），请更换更小的图片"
                showAlert = true
                return
            }
            guard let url = try? await APIClient.shared.uploadMedia(
                data: jpeg, fileName: "avatar.jpg", mimeType: "image/jpeg"
            ) else {
                alertTitle = "提示"
                alertMessage = "头像上传失败，请检查网络"
                showAlert = true
                return
            }
            await store.updateAvatar(url: url)
            alertTitle = "成功"
            alertMessage = "头像已更新"
            showAlert = true
        }
    }

    /// 压缩图片至最长边 512px 并转 JPEG（头像）
    private func downscaledJPEG(_ image: UIImage) -> Data? {
        let maxSide: CGFloat = 512
        let size = image.size
        var target = image
        if max(size.width, size.height) > maxSide {
            let scale = maxSide / max(size.width, size.height)
            let newSize = CGSize(width: size.width * scale, height: size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: newSize)
            target = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: newSize))
            }
        }
        return target.jpegData(compressionQuality: 0.8)
    }

    private var creditRing: some View {
        ZStack {
            Circle()
                .stroke(Theme.divider, lineWidth: 6)
            Circle()
                .trim(from: 0, to: min(CGFloat(store.currentUser.creditScore) / 100, 1))
                .stroke(Theme.primary, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            VStack(spacing: 0) {
                Text("\(Int(store.currentUser.creditScore))")
                    .font(.headline)
                    .bold()
                    .foregroundStyle(Theme.textPrimary)
                Text("信用分")
                    .font(.system(size: 9))
                    .foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(width: 64, height: 64)
    }

    // MARK: - 我的档案

    private var archiveSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("我的档案")
                .font(.subheadline)
                .bold()
                .foregroundStyle(Theme.textPrimary)
            HStack(spacing: 12) {
                statTile("\(store.colleagues.count)", "同事档案", color: Theme.primary) {
                    showColleagues = true
                }
                statTile("\(store.companies.count)", "公司属性", color: Theme.secondary) {
                    showCompanyList = true
                }
                statTile("\(store.myComplaints.count)", "我的吐槽", color: Theme.primaryDeep) {
                    showMyStatuses = true
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func statTile(_ value: String, _ title: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 6) {
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
                Image(systemName: "clock.arrow.circlepath")
                    .foregroundStyle(Theme.primary)
                    .frame(width: 22)
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
            // v3：「更多」并入「我的」—— AI 洞察入口
            toolRow(icon: "sparkles", title: "AI 洞察") { showAI = true }
            Divider().padding(.leading, 40)
            toolRow(icon: "person.2", title: "同事档案") { showColleagues = true }
            Divider().padding(.leading, 40)
            toolRow(icon: "building.2", title: "公司属性管理") { showCompanyList = true }
            Divider().padding(.leading, 40)
            toolRow(icon: "text.bubble", title: "我的吐槽") { showMyStatuses = true }
            Divider().padding(.leading, 40)
            toolRow(icon: "info.circle", title: "关于职场那些事") {
                alertTitle = "关于职场那些事"
                alertMessage = "职场那些事 —— 记录职场里的千奇百怪：甩锅、画饼、加班、PUA…… 四维标签（同事属性 / 公司属性 / 主题 / 软件）帮你把槽点记得清清楚楚。文明吐槽，不指名道姓，不人身攻击。"
                showAlert = true
            }
            Divider().padding(.leading, 40)
            toolRow(icon: "arrow.left.arrow.right.circle", title: "切换账号 / 退出登录") {
                showLogoutConfirm = true
            }
        }
        .padding(.horizontal, 14)
        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.cardBg))
        .overlay(RoundedRectangle(cornerRadius: 16).stroke(Theme.divider, lineWidth: 1))
    }

    private func toolRow(icon: String, title: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: icon)
                    .foregroundStyle(Theme.primary)
                    .frame(width: 22)
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(Theme.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(Theme.textSecondary.opacity(0.6))
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
