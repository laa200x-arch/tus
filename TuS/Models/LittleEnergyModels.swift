import Foundation

struct LittleEnergyMood: Codable, Hashable, Identifiable {
    let id: String
    let label: String
    let legacyEmoji: String?
    let score: Int
    let assetName: String
    let fallbackText: String
}

struct LittleEnergyOutfit: Codable, Hashable {
    var topId: String?
    var bottomId: String?
    var shoesId: String?
    var accessoryIds: [String]

    init(topId: String? = nil, bottomId: String? = nil, shoesId: String? = nil, accessoryIds: [String] = []) {
        self.topId = topId
        self.bottomId = bottomId
        self.shoesId = shoesId
        self.accessoryIds = accessoryIds
    }

    static let `default` = LittleEnergyOutfit(
        topId: "top_tshirt", bottomId: "bottom_slacks",
        shoesId: "shoes_sneakers", accessoryIds: []
    )

    var normalized: LittleEnergyOutfit {
        var seenAccessories = Set<String>()
        let normalizedAccessories = accessoryIds.filter {
            LittleEnergyCatalog.accessories.contains($0) && seenAccessories.insert($0).inserted
        }
        return LittleEnergyOutfit(
            topId: topId.flatMap { LittleEnergyCatalog.tops.contains($0) ? $0 : nil }
                ?? LittleEnergyOutfit.default.topId,
            bottomId: bottomId.flatMap { LittleEnergyCatalog.bottoms.contains($0) ? $0 : nil }
                ?? LittleEnergyOutfit.default.bottomId,
            shoesId: shoesId.flatMap { LittleEnergyCatalog.shoes.contains($0) ? $0 : nil }
                ?? LittleEnergyOutfit.default.shoesId,
            accessoryIds: normalizedAccessories
        )
    }

    var apiDictionary: [String: Any] {
        let value = normalized
        return [
            "topId": value.topId ?? LittleEnergyOutfit.default.topId!,
            "bottomId": value.bottomId ?? LittleEnergyOutfit.default.bottomId!,
            "shoesId": value.shoesId ?? LittleEnergyOutfit.default.shoesId!,
            "accessoryIds": value.accessoryIds
        ]
    }
}

enum LittleEnergyRole: Hashable {
    case user
    case darkColleague

    var assetName: String? {
        switch self {
        case .user: return nil
        case .darkColleague: return "dark-colleague"
        }
    }
}

enum LittleEnergyCatalog {
    static let defaultMoodID = "xnz_happy"

    static let moods: [LittleEnergyMood] = [
        mood("xnz_happy", "开心", "😄", 3), mood("xnz_joyful", "快乐", nil, 3),
        mood("xnz_calm", "平静", "😐", 1), mood("xnz_excited", "兴奋", nil, 3),
        mood("xnz_proud", "自豪", nil, 3), mood("xnz_love", "爱心", nil, 3),
        mood("xnz_grateful", "感激", nil, 3), mood("xnz_expectant", "期待", nil, 2),
        mood("xnz_surprised", "惊讶", nil, 0), mood("xnz_worried", "担忧", nil, -1),
        mood("xnz_anxious", "焦虑", nil, -2), mood("xnz_tired", "疲惫", "😮‍💨", -2),
        mood("xnz_stressed", "压力大", nil, -3), mood("xnz_sad", "难过", "💀", -3),
        mood("xnz_disappointed", "失望", nil, -2), mood("xnz_lonely", "孤独", nil, -3),
        mood("xnz_irritated", "烦躁", nil, -2), mood("xnz_angry", "愤怒", "😡", -3),
        mood("xnz_jealous", "嫉妒", nil, -2), mood("xnz_embarrassed", "尴尬", nil, -1),
        mood("xnz_guilty", "愧疚", nil, -2), mood("xnz_confused", "困惑", nil, -1),
        mood("xnz_shocked", "震惊", nil, -1), mood("xnz_determined", "坚定", nil, 2),
        mood("xnz_motivated", "斗志", nil, 3), mood("xnz_composed", "从容", "🙂", 1),
        mood("xnz_sleepy", "困倦", nil, -2)
    ]

    static let tops = ["top_tshirt", "top_hoodie", "top_shirt", "top_sweater", "top_jacket"]
    static let bottoms = ["bottom_slacks", "bottom_jeans", "bottom_cargo", "bottom_shorts", "bottom_skirt"]
    static let shoes = ["shoes_sneakers", "shoes_canvas", "shoes_leather", "shoes_boots", "shoes_casual"]
    static let accessories = [
        "accessory_glasses", "accessory_hat", "accessory_headphones", "accessory_watch",
        "accessory_necklace", "accessory_ring", "accessory_bracelet", "accessory_backpack",
        "accessory_tote_bag", "accessory_crossbody_bag", "accessory_belt", "accessory_hairclip"
    ]

    static func normalizeMood(_ value: String?) -> String {
        guard let value else { return defaultMoodID }
        if moods.contains(where: { $0.id == value }) { return value }
        return moods.first(where: { $0.legacyEmoji == value })?.id ?? defaultMoodID
    }

    static func mood(for value: String?) -> LittleEnergyMood {
        moods.first(where: { $0.id == normalizeMood(value) }) ?? moods[0]
    }

    private static func mood(_ id: String, _ label: String, _ legacyEmoji: String?, _ score: Int) -> LittleEnergyMood {
        LittleEnergyMood(
            id: id, label: label, legacyEmoji: legacyEmoji, score: score,
            assetName: id, fallbackText: "[小能仔·\(label)]"
        )
    }
}
