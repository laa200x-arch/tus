import XCTest
@testable import TuS

/// 首页重构导航契约：五项导航顺序（首页/广场/中间发布/消息/我的），
/// 中间发布是动作而非可选中页面，原 AI Tab 已移除。
final class HomeNavigationTests: XCTestCase {
    func testTabOrderMatchesRedesignedNavigation() {
        XCTAssertEqual(HomeTab.allCases, [.home, .plaza, .compose, .messages, .mine])
    }

    func testTabRawValuesAreStable() {
        XCTAssertEqual(HomeTab.home.rawValue, 0)
        XCTAssertEqual(HomeTab.plaza.rawValue, 1)
        XCTAssertEqual(HomeTab.compose.rawValue, 2)
        XCTAssertEqual(HomeTab.messages.rawValue, 3)
        XCTAssertEqual(HomeTab.mine.rawValue, 4)
    }

    func testComposeIsActionNotSelectablePage() {
        XCTAssertTrue(HomeTab.compose.isComposeAction)
        for tab in [HomeTab.home, .plaza, .messages, .mine] {
            XCTAssertFalse(tab.isComposeAction, "\(tab) 必须是可选中的真实页面")
        }
    }

    func testTitlesAndIcons() {
        XCTAssertEqual(HomeTab.home.title, "首页")
        XCTAssertEqual(HomeTab.plaza.title, "广场")
        XCTAssertEqual(HomeTab.messages.title, "消息")
        XCTAssertEqual(HomeTab.mine.title, "我的")
        XCTAssertEqual(HomeTab.compose.icon, "plus.circle.fill")
    }

    func testNoDedicatedAITabRemains() {
        let titles = HomeTab.allCases.map(\.title)
        XCTAssertFalse(titles.contains("AI"))
        XCTAssertEqual(titles.filter { !$0.isEmpty }.count, 4, "应为四个可选中页面 + 一个发布动作")
    }

    func testHomeMetricsMatchVisualContract() {
        XCTAssertEqual(HomeMetrics.pageHorizontal, 20)
        XCTAssertEqual(HomeMetrics.cardRadius, 24)
        XCTAssertEqual(HomeMetrics.sectionGap, 18)
        XCTAssertEqual(HomeMetrics.cardShadowRadius, 18)
    }

    func testHomeRoutesAreHashable() {
        let routes: Set<HomeRoute> = [.plaza, .myComplaints]
        XCTAssertTrue(routes.contains(.plaza))
        XCTAssertTrue(routes.contains(.myComplaints))
        XCTAssertNotEqual(HomeRoute.plaza, HomeRoute.myComplaints)
    }
}
