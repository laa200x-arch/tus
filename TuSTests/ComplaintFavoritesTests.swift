import XCTest
@testable import TuS

final class ComplaintFavoritesTests: XCTestCase {
    func testFavoriteDecisionReconcilesEveryCachedCollection() {
        let complaint = makeComplaint(id: "c1")

        let changed = ComplaintFavoriteDecision.apply(
            id: "c1",
            favorited: true,
            favoriteCount: 1,
            feed: [complaint],
            mine: [complaint],
            favorites: []
        )

        XCTAssertTrue(changed.feed[0].favorited)
        XCTAssertEqual(changed.feed[0].favoriteCount, 1)
        XCTAssertTrue(changed.mine[0].favorited)
        XCTAssertEqual(changed.favorites.map(\.id), ["c1"])
    }

    func testLegacyComplaintResponseDefaultsFavoriteFields() throws {
        let data = Data("""
        {"id":"c1","userId":"u1","authorName":"阿青","avatarSymbol":"person.fill","isAnonymous":false,"content":"测试","colleagueId":null,"colleagueName":null,"category":null,"behaviorTags":[],"sentiment":null,"aiExtracted":null,"likeCount":0,"resonanceCount":0,"hotScore":0,"liked":false,"resonated":false,"time":"2026-08-29T00:00:00Z"}
        """.utf8)
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        let complaint = try decoder.decode(ComplaintModel.self, from: data)

        XCTAssertFalse(complaint.favorited)
        XCTAssertEqual(complaint.favoriteCount, 0)
    }

    private func makeComplaint(id: String) -> ComplaintModel {
        ComplaintModel(
            id: id,
            userId: "u1",
            authorName: "阿青",
            avatarSymbol: "person.fill",
            littleEnergyOutfit: .default,
            isAnonymous: false,
            content: "测试",
            colleagueId: nil,
            colleagueName: nil,
            category: nil,
            behaviorTags: [],
            sentiment: "xnz_happy",
            aiExtracted: nil,
            likeCount: 0,
            resonanceCount: 0,
            hotScore: 0,
            liked: false,
            resonated: false,
            commentCount: 0,
            resonanceRate: 0,
            time: Date(timeIntervalSince1970: 0)
        )
    }
}
