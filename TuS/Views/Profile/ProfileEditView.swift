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
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    Text("账号信息")
                        .font(.headline)
                        .foregroundStyle(Theme.textSecondary)
                    VStack(spacing: 0) {
                        profileField("昵称", text: $nickname)
                        Divider().overlay(Theme.divider)
                        profileField("简介", text: $bio)
                        Divider().overlay(Theme.divider)
                        profileField("所在城市", text: $location)
                    }
                    .padding(.horizontal, 16)
                    .background(RoundedRectangle(cornerRadius: 22).fill(Theme.cardBg))

                    Text("小能仔换装")
                        .font(.headline)
                        .foregroundStyle(Theme.textSecondary)

                    VStack(spacing: 14) {
                        LittleEnergyTurntableView(outfit: outfitDraft.outfit, size: 238)
                            .frame(maxWidth: .infinity)
                            .background(
                                RoundedRectangle(cornerRadius: 20)
                                    .fill(Theme.inputBg)
                            )
                        Label("左右拖动查看 3D 造型", systemImage: "hand.draw")
                            .font(.caption)
                            .foregroundStyle(Theme.textSecondary)

                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 12) {
                                ForEach(LittleEnergyLook.all) { look in
                                    let selected = LittleEnergyLook.resolve(outfit: outfitDraft.outfit).id == look.id
                                    Button {
                                        outfitDraft = OutfitDraft(outfit: look.canonicalOutfit)
                                    } label: {
                                        VStack(spacing: 7) {
                                            Image(look.frontAssetName)
                                                .resizable()
                                                .scaledToFit()
                                                .frame(width: 80, height: 90)
                                            Text(look.title)
                                                .font(.caption)
                                                .foregroundStyle(selected ? Theme.primary : Theme.textPrimary)
                                        }
                                        .frame(width: 104)
                                        .padding(.vertical, 10)
                                        .background(RoundedRectangle(cornerRadius: 16).fill(Theme.inputBg))
                                        .overlay(RoundedRectangle(cornerRadius: 16).stroke(selected ? Theme.primary : Theme.divider, lineWidth: selected ? 2 : 1))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityAddTraits(selected ? .isSelected : [])
                                }
                            }
                        }
                    }
                    .padding(16)
                    .background(RoundedRectangle(cornerRadius: 22).fill(Theme.cardBg))

                    Button(isSaving ? "保存中…" : "保存资料与造型") { saveAccount() }
                        .font(.headline)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 17)
                        .background(Capsule().fill(Theme.primary))
                        .disabled(nickname.trimmingCharacters(in: .whitespaces).isEmpty || isSaving)

                    if let savedMessage {
                        Text(savedMessage).font(.caption).foregroundStyle(Theme.success)
                    }
                    if let errorMessage {
                        Text(errorMessage).font(.caption).foregroundStyle(Theme.danger)
                    }
                }
                .padding(16)
            }
            .background(Theme.bg)
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

    private func profileField(_ title: String, text: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Text(title)
                .foregroundStyle(Theme.textPrimary)
                .frame(width: 72, alignment: .leading)
            TextField(title, text: text)
                .multilineTextAlignment(.leading)
                .foregroundStyle(Theme.textPrimary)
                .padding(.vertical, 15)
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
