import XCTest
@testable import TuS

final class HomeOverviewDecodingTests: XCTestCase {
    func testDecodesCompleteHomeOverviewContract() throws {
        let overview = try APIClient.decoder.decode(HomeOverview.self, from: Data(completeOverviewJSON.utf8))

        XCTAssertEqual(overview.serverTime, APIClient.parseDate("2026-08-27T12:34:56.789Z"))
        XCTAssertEqual(overview.greetingPeriod, "afternoon")
        XCTAssertEqual(overview.user.id, "42")
        XCTAssertEqual(overview.user.userName, "小王")
        XCTAssertEqual(overview.user.littleEnergyOutfit.topId, "top_hoodie")
        XCTAssertEqual(overview.user.littleEnergyOutfit.bottomId, "bottom_jeans")
        XCTAssertEqual(overview.user.littleEnergyOutfit.shoesId, "shoes_canvas")
        XCTAssertEqual(overview.user.littleEnergyOutfit.accessoryIds, ["accessory_hat"])

        XCTAssertTrue(overview.stats.moodCheckedToday)
        XCTAssertEqual(overview.stats.plazaComplaintCount, 18)
        XCTAssertEqual(overview.stats.myComplaintCount, 4)
        XCTAssertEqual(overview.stats.colleagueCount, 7)
        XCTAssertEqual(overview.stats.unreadMessageCount, 3)

        XCTAssertEqual(overview.moodToday?.mood, "xnz_tired")
        XCTAssertEqual(overview.moodToday?.stressSources, ["deadline", "meeting"])
        XCTAssertEqual(overview.moodToday?.note, "今天也要加油")
        XCTAssertEqual(overview.moodToday?.date, "2026-08-27")

        XCTAssertEqual(overview.quickMoods.map(\.id), ["xnz_motivated", "xnz_composed", "xnz_calm", "xnz_tired", "xnz_angry"])
        XCTAssertEqual(overview.quickMoods.map(\.label), ["元气", "还行", "一般", "好累", "想辞职"])
        XCTAssertEqual(overview.quickMoods.map(\.assetName), ["xnz_motivated", "xnz_composed", "xnz_calm", "xnz_tired", "xnz_angry"])

        let complaint = try XCTUnwrap(overview.latestComplaints.first)
        XCTAssertEqual(complaint.id, "101")
        XCTAssertEqual(complaint.userId, "42")
        XCTAssertEqual(complaint.authorName, "小王")
        XCTAssertEqual(complaint.avatarSymbol, "😀")
        XCTAssertEqual(complaint.littleEnergyOutfit?.topId, "top_jacket")
        XCTAssertFalse(complaint.isAnonymous)
        XCTAssertEqual(complaint.content, "需求又临时改了")
        XCTAssertEqual(complaint.sentiment, "xnz_angry")
        XCTAssertEqual(complaint.likeCount, 7)
        XCTAssertEqual(complaint.resonanceCount, 3)
        XCTAssertEqual(complaint.commentCount, 2)
        XCTAssertEqual(complaint.time, APIClient.parseDate("2026-08-27T11:00:00Z"))

        XCTAssertEqual(overview.personality?.name, "执行者")
        XCTAssertEqual(overview.personality?.totalComplaints, 12)
        XCTAssertEqual(overview.personality?.summary, "完整报告在 AI 洞察中查看")
        XCTAssertEqual(overview.colleagueSummary.count, 7)
        XCTAssertEqual(overview.colleagueSummary.averageScore, 8.5)
        XCTAssertEqual(overview.colleagueSummary.healthScore, 85)
    }

    func testDecodesEmptyOptionalModulesWithoutWeakeningRequiredOverviewFields() throws {
        let overview = try APIClient.decoder.decode(HomeOverview.self, from: Data(emptyOverviewJSON.utf8))

        XCTAssertFalse(overview.stats.moodCheckedToday)
        XCTAssertEqual(overview.stats.plazaComplaintCount, 0)
        XCTAssertEqual(overview.stats.myComplaintCount, 0)
        XCTAssertEqual(overview.stats.colleagueCount, 0)
        XCTAssertEqual(overview.stats.unreadMessageCount, 0)
        XCTAssertNil(overview.moodToday)
        XCTAssertEqual(overview.quickMoods.count, 5)
        XCTAssertTrue(overview.latestComplaints.isEmpty)
        XCTAssertNil(overview.personality)
        XCTAssertEqual(overview.colleagueSummary.count, 0)
        XCTAssertNil(overview.colleagueSummary.averageScore)
        XCTAssertNil(overview.colleagueSummary.healthScore)
    }

    private let completeOverviewJSON = """
    {
      "serverTime": "2026-08-27T12:34:56.789Z",
      "greetingPeriod": "afternoon",
      "user": {
        "id": "42",
        "userName": "小王",
        "littleEnergyOutfit": {
          "topId": "top_hoodie",
          "bottomId": "bottom_jeans",
          "shoesId": "shoes_canvas",
          "accessoryIds": ["accessory_hat"]
        }
      },
      "stats": {
        "moodCheckedToday": true,
        "plazaComplaintCount": 18,
        "myComplaintCount": 4,
        "colleagueCount": 7,
        "unreadMessageCount": 3
      },
      "moodToday": {
        "mood": "xnz_tired",
        "stressSources": ["deadline", "meeting"],
        "note": "今天也要加油",
        "date": "2026-08-27"
      },
      "quickMoods": [
        { "id": "xnz_motivated", "label": "元气", "assetName": "xnz_motivated" },
        { "id": "xnz_composed", "label": "还行", "assetName": "xnz_composed" },
        { "id": "xnz_calm", "label": "一般", "assetName": "xnz_calm" },
        { "id": "xnz_tired", "label": "好累", "assetName": "xnz_tired" },
        { "id": "xnz_angry", "label": "想辞职", "assetName": "xnz_angry" }
      ],
      "latestComplaints": [
        {
          "id": "101",
          "userId": "42",
          "authorName": "小王",
          "avatarSymbol": "😀",
          "littleEnergyOutfit": {
            "topId": "top_jacket",
            "bottomId": "bottom_slacks",
            "shoesId": "shoes_sneakers",
            "accessoryIds": []
          },
          "isAnonymous": false,
          "content": "需求又临时改了",
          "sentiment": "xnz_angry",
          "likeCount": 7,
          "resonanceCount": 3,
          "commentCount": 2,
          "time": "2026-08-27T11:00:00Z"
        }
      ],
      "personality": {
        "name": "执行者",
        "totalComplaints": 12,
        "summary": "完整报告在 AI 洞察中查看"
      },
      "colleagueSummary": {
        "count": 7,
        "averageScore": 8.5,
        "healthScore": 85
      }
    }
    """

    private let emptyOverviewJSON = """
    {
      "serverTime": "2026-08-27T08:00:00Z",
      "greetingPeriod": "morning",
      "user": {
        "id": "42",
        "userName": "小王",
        "littleEnergyOutfit": {
          "topId": "top_tshirt",
          "bottomId": "bottom_slacks",
          "shoesId": "shoes_sneakers",
          "accessoryIds": []
        }
      },
      "stats": {
        "moodCheckedToday": false,
        "plazaComplaintCount": 0,
        "myComplaintCount": 0,
        "colleagueCount": 0,
        "unreadMessageCount": 0
      },
      "moodToday": null,
      "quickMoods": [
        { "id": "xnz_motivated", "label": "元气", "assetName": "xnz_motivated" },
        { "id": "xnz_composed", "label": "还行", "assetName": "xnz_composed" },
        { "id": "xnz_calm", "label": "一般", "assetName": "xnz_calm" },
        { "id": "xnz_tired", "label": "好累", "assetName": "xnz_tired" },
        { "id": "xnz_angry", "label": "想辞职", "assetName": "xnz_angry" }
      ],
      "latestComplaints": [],
      "personality": null,
      "colleagueSummary": {
        "count": 0,
        "averageScore": null,
        "healthScore": null
      }
    }
    """
}
