import SwiftUI
import PhotosUI

/// 编辑资料（头像 / 昵称 / 简介 / 所在城市）
struct ProfileEditView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var nickname = ""
    @State private var bio = ""
    @State private var location = ""
    @State private var avatarItem: PhotosPickerItem?
    @State private var isUploadingAvatar = false
    @State private var errorMessage: String?
    @State private var savedMessage: String?
    @State private var outfitDraft = OutfitDraft(outfit: .default)
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("头像") {
                    HStack(spacing: 14) {
                        AvatarView(user: store.currentUser, size: 56)
                        PhotosPicker(selection: $avatarItem, matching: .images) {
                            if isUploadingAvatar {
                                ProgressView()
                            } else {
                                Label("更换头像", systemImage: "camera.fill")
                                    .font(.subheadline)
                                    .foregroundStyle(Theme.primary)
                            }
                        }
                        .disabled(isUploadingAvatar)
                    }
                }

                Section("账号信息") {
                    TextField("昵称", text: $nickname)
                    TextField("简介", text: $bio, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("所在城市（如：广州·天河）", text: $location)
                }

                Section("小能仔换装") {
                    HStack {
                        Spacer()
                        LittleEnergyAvatarView(
                            moodID: store.currentMoodID,
                            outfit: outfitDraft.outfit,
                            size: 150
                        )
                        Spacer()
                    }
                    outfitPicker(title: "上衣", ids: LittleEnergyCatalog.tops, selection: $outfitDraft.topID)
                    outfitPicker(title: "下装", ids: LittleEnergyCatalog.bottoms, selection: $outfitDraft.bottomID)
                    outfitPicker(title: "鞋子", ids: LittleEnergyCatalog.shoes, selection: $outfitDraft.shoesID)
                    accessoryPicker
                }

                Section {
                    Button(isSaving ? "保存中…" : "保存资料与穿搭") { saveAccount() }
                        .frame(maxWidth: .infinity)
                        .disabled(nickname.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }

                if let savedMessage {
                    Section {
                        Text(savedMessage)
                            .font(.caption)
                            .foregroundStyle(Theme.success)
                    }
                }
                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .font(.caption)
                            .foregroundStyle(Theme.danger)
                    }
                }

                Section {
                    Button("完成") { dismiss() }
                        .frame(maxWidth: .infinity)
                        .font(.headline)
                }
            }
            .navigationTitle("编辑资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("取消") { dismiss() }
                }
            }
            .onAppear {
                nickname = store.currentUser.userName
                bio = store.currentUser.bio
                location = store.currentUser.locationLabel
                outfitDraft = OutfitDraft(outfit: store.currentUser.littleEnergyOutfit)
            }
            .onChange(of: avatarItem) { _ in
                handleAvatarSelection()
            }
        }
    }

    /// 保存账号信息（昵称/简介/位置）
    private func saveAccount() {
        Task {
            isSaving = true
            defer { isSaving = false }
            do {
                try await store.updateProfile(
                    nickname: nickname.trimmingCharacters(in: .whitespaces),
                    bio: bio.trimmingCharacters(in: .whitespacesAndNewlines),
                    locationLabel: location.trimmingCharacters(in: .whitespaces),
                    littleEnergyOutfit: outfitDraft.outfit
                )
                errorMessage = nil
                savedMessage = "账号信息已保存"
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? "保存失败"
            }
        }
    }

    private func outfitPicker(title: String, ids: [String], selection: Binding<String>) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.caption).foregroundStyle(Theme.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(ids, id: \.self) { id in
                        Button {
                            selection.wrappedValue = id
                        } label: {
                            Image(id)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 54, height: 54)
                                .padding(4)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(selection.wrappedValue == id ? Theme.primary : Theme.divider, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(outfitLabel(id))
                    }
                }
            }
        }
    }

    private var accessoryPicker: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("配饰（可多选）").font(.caption).foregroundStyle(Theme.textSecondary)
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    Button {
                        outfitDraft.accessoryIDs = []
                    } label: {
                        Text("无配饰")
                            .font(.caption2)
                            .frame(width: 54, height: 54)
                            .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
                            .overlay(RoundedRectangle(cornerRadius: 10).stroke(outfitDraft.accessoryIDs.isEmpty ? Theme.primary : Theme.divider, lineWidth: 2))
                    }
                    .buttonStyle(.plain)
                    ForEach(LittleEnergyCatalog.accessories, id: \.self) { id in
                        let selected = outfitDraft.accessoryIDs.contains(id)
                        Button {
                            if selected { outfitDraft.accessoryIDs.removeAll { $0 == id } }
                            else { outfitDraft.accessoryIDs.append(id) }
                        } label: {
                            Image(id)
                                .resizable()
                                .scaledToFit()
                                .frame(width: 54, height: 54)
                                .padding(4)
                                .background(RoundedRectangle(cornerRadius: 10).fill(Theme.inputBg))
                                .overlay(RoundedRectangle(cornerRadius: 10).stroke(selected ? Theme.primary : Theme.divider, lineWidth: 2))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(outfitLabel(id))
                    }
                }
            }
        }
    }

    private func outfitLabel(_ id: String) -> String {
        id.replacingOccurrences(of: "top_", with: "上衣 ")
            .replacingOccurrences(of: "bottom_", with: "下装 ")
            .replacingOccurrences(of: "shoes_", with: "鞋子 ")
            .replacingOccurrences(of: "accessory_", with: "配饰 ")
    }

    /// 相册选择头像 → 压缩上传 → 更新
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
                errorMessage = "头像读取失败，请重试"
                return
            }
            guard jpeg.count <= 1024 * 1024 else {
                errorMessage = "头像过大（压缩后仍超过 1MB），请更换更小的图片"
                return
            }
            guard let url = try? await APIClient.shared.uploadMedia(data: jpeg, fileName: "avatar.jpg", mimeType: "image/jpeg") else {
                errorMessage = "头像上传失败，请检查网络"
                return
            }
            await store.updateAvatar(url: url)
            savedMessage = "头像已更新"
        }
    }

    /// 压缩头像至最长边 512px
    private func downscaledJPEG(_ image: UIImage) -> Data? {
        let maxSide: CGFloat = 512
        let size = image.size
        var target = image
        if max(size.width, size.height) > maxSide {
            let scale = maxSide / max(size.width, size.height)
            let newSize = CGSize(width: size.width * scale, height: size.height * scale)
            let renderer = UIGraphicsImageRenderer(size: newSize)
            target = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: newSize)) }
        }
        return target.jpegData(compressionQuality: 0.8)
    }
}

#Preview {
    ProfileEditView()
        .environmentObject(MockDataStore.shared)
}
