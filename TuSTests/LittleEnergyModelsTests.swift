import XCTest
@testable import TuS

final class LittleEnergyModelsTests: XCTestCase {
    func testCatalogMatchesSharedStableIDs() {
        XCTAssertEqual(LittleEnergyCatalog.moods.count, 27)
        XCTAssertEqual(Set(LittleEnergyCatalog.moods.map(\.id)).count, 27)
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("😄"), "xnz_happy")
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("xnz_grateful"), "xnz_grateful")
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood("unknown"), "xnz_happy")
        XCTAssertEqual(LittleEnergyCatalog.normalizeMood(nil), "xnz_happy")
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

    func testMoodDecisionOnlyReplacesStateAfterSuccess() {
        let previous = MoodCheckin(date: "2026-08-26", mood: "xnz_calm", stressSources: [], note: nil, createdAt: nil)
        let saved = MoodCheckin(date: "2026-08-26", mood: "xnz_happy", stressSources: [], note: nil, createdAt: nil)
        XCTAssertEqual(LittleEnergyStateDecisions.mood(previous: previous, saved: saved)?.mood, "xnz_happy")
        XCTAssertEqual(LittleEnergyStateDecisions.mood(previous: previous, saved: nil)?.mood, "xnz_calm")
    }

    func testProfileDecisionOnlyReplacesUserAfterSuccess() {
        let previous = UserModel(userName: "Before", avatarSymbol: "person.fill", bio: "", locationLabel: "", distanceKm: nil, creditScore: 100, verification: .none)
        var saved = previous
        saved.userName = "After"
        saved.littleEnergyOutfit = LittleEnergyOutfit(topId: "top_hoodie")
        XCTAssertEqual(LittleEnergyStateDecisions.profile(previous: previous, saved: saved).userName, "After")
        XCTAssertEqual(LittleEnergyStateDecisions.profile(previous: previous, saved: nil).userName, "Before")
        XCTAssertEqual(LittleEnergyStateDecisions.profile(previous: previous, saved: nil).littleEnergyOutfit, .default)
    }

    func testComplaintOutfitDecodingAndAnonymousFallback() throws {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        let visible = try decoder.decode(ComplaintModel.self, from: Data(complaintJSON(outfit: "\"littleEnergyOutfit\":{\"topId\":\"top_hoodie\",\"bottomId\":\"bottom_jeans\",\"shoesId\":\"shoes_canvas\",\"accessoryIds\":[]},").utf8))
        XCTAssertEqual(ComplaintPresentation.outfit(for: visible).topId, "top_hoodie")
        let anonymous = try decoder.decode(ComplaintModel.self, from: Data(complaintJSON(outfit: "", anonymous: true).utf8))
        XCTAssertEqual(ComplaintPresentation.outfit(for: anonymous), .default)
    }

    private func complaintJSON(outfit: String, anonymous: Bool = false) -> String {
        """{"id":"1","userId":"2","authorName":"A","avatarSymbol":"x",\(outfit)"isAnonymous":\(anonymous),"content":"c","colleagueId":null,"colleagueName":null,"category":null,"behaviorTags":[],"sentiment":null,"aiExtracted":null,"likeCount":0,"resonanceCount":0,"hotScore":0,"liked":false,"resonated":false,"commentCount":0,"resonanceRate":0,"time":"2026-08-26T00:00:00Z"}"""
    }
}
