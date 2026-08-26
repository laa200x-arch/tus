import XCTest
@testable import TuS

final class LittleEnergyModelsTests: XCTestCase {
    func testCatalogMatchesSharedStableIDs() {
        XCTAssertEqual(LittleEnergyCatalog.moods.count, 27)
        XCTAssertEqual(Set(LittleEnergyCatalog.moods.map(\.id)).count, 27)
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("😄"), "xnz_happy")
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("xnz_grateful"), "xnz_grateful")
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("unknown"), "xnz_happy")
    }

    func testUnknownOutfitFallsBackToDefaults() {
        let outfit = LittleEnergyOutfit(
            topId: "bad",
            bottomId: nil,
            shoesId: nil,
            accessoryIds: ["../x"]
        )
        XCTAssertEqual(outfit.normalized, .default)
    }

    func testOutfitNormalizationMatchesServerPerFieldRules() {
        let outfit = LittleEnergyOutfit(
            topId: "bad",
            bottomId: "bottom_jeans",
            shoesId: "shoes_canvas",
            accessoryIds: ["accessory_hat", "../x", "accessory_hat"]
        ).normalized
        XCTAssertEqual(outfit.topId, LittleEnergyOutfit.default.topId)
        XCTAssertEqual(outfit.bottomId, "bottom_jeans")
        XCTAssertEqual(outfit.shoesId, "shoes_canvas")
        XCTAssertEqual(outfit.accessoryIds, ["accessory_hat"])
    }

    func testDarkColleagueIsNotAnOutfitChoice() {
        let allOutfitIDs = LittleEnergyCatalog.tops
            + LittleEnergyCatalog.bottoms
            + LittleEnergyCatalog.shoes
            + LittleEnergyCatalog.accessories
        XCTAssertFalse(allOutfitIDs.contains("dark-colleague"))
        XCTAssertEqual(LittleEnergyRole.darkColleague.assetName, "dark-colleague")
    }

    func testServerUserWithoutOutfitDecodesToDefault() throws {
        let data = Data("""
        {
          "id":"1","username":"demo","userName":"Demo",
          "avatarSymbol":"person.crop.circle","avatarUrl":null,
          "bio":"","locationLabel":"","distanceKm":null,
          "creditScore":100,"verification":"none",
          "isExposureVip":false,"exposureUntil":null
        }
        """.utf8)
        let user = try JSONDecoder().decode(ServerUser.self, from: data)
        XCTAssertEqual(user.littleEnergyOutfit, .default)
    }

    func testMoodCheckinUsesAllCatalogEntries() {
        XCTAssertEqual(MoodCheckinSelection.items.count, 27)
        XCTAssertEqual(MoodCheckinSelection.items.map(\.id), LittleEnergyCatalog.moods.map(\.id))
    }

    func testChatEmojiPayloadUsesStableProtocol() {
        let payload = ChatEmojiPayload(id: "xnz_happy")
        XCTAssertEqual(payload.mediaType, "little_energy_emoji")
        XCTAssertEqual(payload.mediaURL, "xnz_happy")
        XCTAssertEqual(payload.fallbackText, "[小能仔·开心]")
    }

    func testOutfitDraftDoesNotMutateSavedValue() {
        let saved = LittleEnergyOutfit.default
        var draft = OutfitDraft(outfit: saved)
        draft.topID = "top_hoodie"
        XCTAssertEqual(saved, .default)
        XCTAssertEqual(draft.outfit.topId, "top_hoodie")
    }

    func testChatEmojiUsesTheSendersOutfit() {
        let mine = LittleEnergyOutfit(topId: "top_hoodie")
        let theirs = LittleEnergyOutfit(topId: "top_jacket")
        XCTAssertEqual(
            ChatEmojiPresentation.outfit(senderIsMe: true, currentUser: mine, partner: theirs).topId,
            "top_hoodie"
        )
        XCTAssertEqual(
            ChatEmojiPresentation.outfit(senderIsMe: false, currentUser: mine, partner: theirs).topId,
            "top_jacket"
        )
    }
}
