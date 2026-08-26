import SwiftUI

struct LittleEnergyAvatarView: View {
    let moodID: String
    let outfit: LittleEnergyOutfit
    let role: LittleEnergyRole
    let size: CGFloat

    init(
        moodID: String = LittleEnergyCatalog.defaultMoodID,
        outfit: LittleEnergyOutfit = .default,
        role: LittleEnergyRole = .user,
        size: CGFloat = 120
    ) {
        self.moodID = moodID
        self.outfit = outfit
        self.role = role
        self.size = size
    }

    var body: some View {
        Group {
            switch role {
            case .darkColleague:
                Image("dark-colleague")
                    .resizable()
                    .scaledToFit()
                    .accessibilityLabel("黑化小能仔同事")
            case .user:
                let safeOutfit = outfit.normalized
                ZStack {
                    layer(LittleEnergyCatalog.mood(for: moodID).assetName)
                    if let topId = safeOutfit.topId { layer(topId) }
                    if let bottomId = safeOutfit.bottomId { layer(bottomId) }
                    if let shoesId = safeOutfit.shoesId { layer(shoesId) }
                    ForEach(safeOutfit.accessoryIds, id: \.self) { layer($0) }
                }
                .accessibilityElement(children: .ignore)
                .accessibilityLabel("小能仔，\(LittleEnergyCatalog.mood(for: moodID).label)")
            }
        }
        .frame(width: size, height: size)
    }

    private func layer(_ assetName: String) -> some View {
        Image(assetName).resizable().scaledToFit()
    }
}
