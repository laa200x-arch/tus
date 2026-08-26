import SwiftUI

enum MoodCheckinSelection {
    static let items = LittleEnergyCatalog.moods
}

struct ChatEmojiPayload: Equatable {
    let mediaType = "little_energy_emoji"
    let mediaURL: String
    let fallbackText: String

    init(id: String) {
        let mood = LittleEnergyCatalog.mood(for: id)
        mediaURL = mood.id
        fallbackText = mood.fallbackText
    }
}

enum ChatEmojiPresentation {
    static func outfit(
        senderIsMe: Bool,
        currentUser: LittleEnergyOutfit,
        partner: LittleEnergyOutfit
    ) -> LittleEnergyOutfit {
        (senderIsMe ? currentUser : partner).normalized
    }
}

enum ComplaintPresentation {
    static func outfit(for complaint: ComplaintModel) -> LittleEnergyOutfit {
        complaint.isAnonymous ? .default : (complaint.littleEnergyOutfit ?? .default).normalized
    }
}

enum LittleEnergyStateDecisions {
    static func mood(previous: MoodCheckin?, saved: MoodCheckin?) -> MoodCheckin? {
        saved ?? previous
    }

    static func profile(previous: UserModel, saved: UserModel?) -> UserModel {
        saved ?? previous
    }
}

struct OutfitDraft: Equatable {
    var topID: String
    var bottomID: String
    var shoesID: String
    var accessoryIDs: [String]

    init(outfit: LittleEnergyOutfit) {
        let value = outfit.normalized
        topID = value.topId ?? LittleEnergyOutfit.default.topId!
        bottomID = value.bottomId ?? LittleEnergyOutfit.default.bottomId!
        shoesID = value.shoesId ?? LittleEnergyOutfit.default.shoesId!
        accessoryIDs = value.accessoryIds
    }

    var outfit: LittleEnergyOutfit {
        LittleEnergyOutfit(topId: topID, bottomId: bottomID, shoesId: shoesID, accessoryIds: accessoryIDs).normalized
    }
}

struct LittleEnergyMoodTile: View {
    let mood: LittleEnergyMood
    var selected = false
    var size: CGFloat = 46

    var body: some View {
        VStack(spacing: 3) {
            LittleEnergyAvatarView(moodID: mood.id, size: size)
            Text(mood.label)
                .font(.caption2)
                .foregroundStyle(selected ? .white : Theme.textSecondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

/// 符号头像（仅含 SF Symbol 占位，用于同事档案 / 同事状态等无 UserModel 场景）
struct SymbolAvatar: View {
    let symbol: String
    var size: CGFloat = 48

    var body: some View {
        ZStack {
            Circle()
                .fill(Theme.gradient)
                .frame(width: size, height: size)
            Text(symbol.isEmpty ? "👤" : symbol)
                .font(.system(size: size * 0.42))
        }
    }
}

/// 信用分徽章（0-100，颜色随等级变化）
struct CreditBadgeView: View {
    let score: Double

    var body: some View {
        let level = CreditScoreManager.shared.creditLevel(for: score)
        HStack(spacing: 3) {
            Image(systemName: "shield.checkered")
            Text("信用 \(Int(score)) · \(level)")
        }
        .font(.caption2)
        .fontWeight(.semibold)
        .foregroundStyle(color)
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Capsule().fill(color.opacity(0.12)))
    }

    private var color: Color {
        if score >= 90 { return Theme.success }
        if score >= 80 { return Theme.primary }
        if score >= 70 { return Theme.secondary }
        return Theme.danger
    }
}

/// 用户头像（自定义头像优先显示图片，否则 SF Symbol + 品牌渐变底）
struct AvatarView: View {
    let user: UserModel
    var size: CGFloat = 48

    var body: some View {
        if let avatarUrl = user.avatarUrl,
           let url = URL(string: AppConfig.serverBase + avatarUrl) {
            AsyncImage(url: url) { phase in
                if let image = phase.image {
                    image
                        .resizable()
                        .scaledToFill()
                        .frame(width: size, height: size)
                        .clipShape(Circle())
                } else {
                    placeholder
                }
            }
            .frame(width: size, height: size)
        } else {
            placeholder
        }
    }

    private var placeholder: some View {
        ZStack {
            Circle()
                .fill(Theme.gradient)
                .frame(width: size, height: size)
            Image(systemName: user.avatarSymbol)
                .font(.system(size: size * 0.42))
                .foregroundStyle(.white)
        }
    }
}

/// 空状态占位
struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 10) {
            Image(systemName: icon)
                .font(.system(size: 42))
                .foregroundStyle(Theme.primary.opacity(0.5))
            Text(title)
                .font(.headline)
                .foregroundStyle(Theme.textPrimary)
            Text(message)
                .font(.caption)
                .foregroundStyle(Theme.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 60)
    }
}
