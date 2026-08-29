import SwiftUI

/// 编辑资料：用户只维护一个小能仔身份；旧 outfit 结构继续作为资料接口的持久化格式。
struct ProfileEditView: View {
    @EnvironmentObject private var store: MockDataStore
    @Environment(\.dismiss) private var dismiss

    @State private var nickname = ""
    @State private var bio = ""
    @State private var location = ""
    @State private var outfitDraft = OutfitDraft(outfit: .default)
    @State private var errorMessage: String?
    @State private var savedMessage: String?
    @State private var isSaving = false

    var body: some View {
        NavigationStack {
            Form {
                Section("账号信息") {
                    TextField("昵称", text: $nickname)
                    TextField("简介", text: $bio, axis: .vertical)
                        .lineLimit(2...4)
                    TextField("所在城市（如：广州·天河）", text: $location)
                }

                Section("小能仔换装") {
                    VStack(spacing: 6) {
                        LittleEnergyTurntableView(outfit: outfitDraft.outfit, size: 190)
                        Text("左右拖动查看 3D 造型")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)
                    }
                    .frame(maxWidth: .infinity)

                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(LittleEnergyLook.all) { look in
                                let selected = LittleEnergyLook.resolve(outfit: outfitDraft.outfit).id == look.id
                                Button {
                                    outfitDraft = OutfitDraft(outfit: look.canonicalOutfit)
                                } label: {
                                    VStack(spacing: 5) {
                                        Image(look.frontAssetName)
                                            .resizable()
                                            .scaledToFit()
                                            .frame(width: 68, height: 68)
                                        Text(look.title)
                                            .font(.caption2)
                                            .foregroundStyle(Theme.textPrimary)
                                    }
                                    .frame(width: 82)
                                    .padding(.vertical, 7)
                                    .background(RoundedRectangle(cornerRadius: 12).fill(Theme.inputBg))
                                    .overlay(RoundedRectangle(cornerRadius: 12).stroke(selected ? Theme.primary : Theme.divider, lineWidth: selected ? 2 : 1))
                                }
                                .buttonStyle(.plain)
                                .accessibilityAddTraits(selected ? .isSelected : [])
                            }
                        }
                    }
                }

                Section {
                    Button(isSaving ? "保存中…" : "保存资料与造型") { saveAccount() }
                        .frame(maxWidth: .infinity)
                        .disabled(nickname.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)
                }

                if let savedMessage {
                    Section { Text(savedMessage).font(.caption).foregroundStyle(Theme.success) }
                }
                if let errorMessage {
                    Section { Text(errorMessage).font(.caption).foregroundStyle(Theme.danger) }
                }
            }
            .navigationTitle("编辑资料")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("取消") { dismiss() } }
            }
            .onAppear {
                nickname = store.currentUser.userName
                bio = store.currentUser.bio
                location = store.currentUser.locationLabel
                outfitDraft = OutfitDraft(outfit: store.currentUser.littleEnergyOutfit)
            }
        }
    }

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
                savedMessage = "账号信息与小能仔造型已保存"
            } catch {
                errorMessage = (error as? LocalizedError)?.errorDescription ?? "保存失败"
            }
        }
    }
}

#Preview {
    ProfileEditView()
        .environmentObject(MockDataStore.shared)
}
