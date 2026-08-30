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
                let look = LittleEnergyLook.resolve(outfit: outfit)
                Image(LittleEnergyCatalog.completeAvatarAsset(moodID: moodID, lookID: look.id))
                    .resizable()
                    .scaledToFit()
                    .accessibilityLabel("小能仔，\(LittleEnergyCatalog.mood(for: moodID).label)")
            }
        }
        .frame(width: size, height: size)
    }

}

/// 资料页使用的四视角转台。它是预渲染的 3D 角色转台，不会把衣服散件叠在角色上。
struct LittleEnergyTurntableView: View {
    let outfit: LittleEnergyOutfit
    let size: CGFloat
    @State private var angle: LittleEnergyTurntableAngle = .front
    @State private var dragStep = 0

    init(outfit: LittleEnergyOutfit, size: CGFloat = 180) {
        self.outfit = outfit
        self.size = size
    }

    var body: some View {
        let look = LittleEnergyLook.resolve(outfit: outfit)
        Image(look.assetName(for: angle))
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .contentShape(Rectangle())
            .gesture(
                DragGesture(minimumDistance: 4)
                    .onChanged { value in
                        guard abs(value.translation.width) > abs(value.translation.height) else { return }
                        let nextStep = Int(value.translation.width / 42)
                        guard nextStep != dragStep else { return }
                        rotate(forward: nextStep < dragStep)
                        dragStep = nextStep
                    }
                    .onEnded { _ in dragStep = 0 }
            )
            .accessibilityLabel("小能仔\(look.title)造型，向左或向右拖动查看角度")
    }

    private func rotate(forward: Bool) {
        let angles = LittleEnergyTurntableAngle.allCases
        let index = angles.firstIndex(of: angle) ?? 0
        let offset = forward ? 1 : -1
        withAnimation(.easeOut(duration: 0.12)) {
            angle = angles[(index + offset + angles.count) % angles.count]
        }
    }
}
