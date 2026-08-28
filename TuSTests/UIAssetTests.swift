import XCTest
@testable import TuS

final class UIAssetTests: XCTestCase {
    func testManifestNamesStayStable() {
        XCTAssertEqual(UIAsset.allCases.count, 41)
        XCTAssertEqual(UIAsset.brandTuS.rawValue, "ui_brand_tus")
        XCTAssertEqual(UIAsset.navPublish.rawValue, "ui_nav_publish")
        XCTAssertEqual(UIAsset.featureCheckin.rawValue, "ui_feature_checkin")
        XCTAssertEqual(UIAsset.messageAI.rawValue, "ui_message_ai")
        XCTAssertEqual(UIAsset.avatarAnonymous.rawValue, "ui_avatar_anonymous")
        XCTAssertEqual(UIAsset.appBackground.rawValue, "ui_bg_app_soft")
        XCTAssertEqual(UIAsset.homeHeroDecoration.rawValue, "ui_decor_home_hero")
    }

    func testAssetNamesAreUnique() {
        let names = UIAsset.allCases.map(\.rawValue)
        XCTAssertEqual(Set(names).count, names.count)
    }
}
