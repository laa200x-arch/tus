import SwiftUI

enum UIAsset: String, CaseIterable {
    case brandTuS = "ui_brand_tus"
    case navHome = "ui_nav_home"
    case navPlaza = "ui_nav_plaza"
    case navPublish = "ui_nav_publish"
    case navMessages = "ui_nav_messages"
    case navProfile = "ui_nav_profile"
    case actionSearch = "ui_action_search"
    case actionBack = "ui_action_back"
    case actionMore = "ui_action_more"
    case actionChevron = "ui_action_chevron"
    case actionLike = "ui_action_like"
    case actionComment = "ui_action_comment"
    case actionShare = "ui_action_share"
    case actionSend = "ui_action_send"
    case actionAdd = "ui_action_add"
    case featureCheckin = "ui_feature_checkin"
    case featurePlaza = "ui_feature_plaza"
    case featureMyComplaints = "ui_feature_my_complaints"
    case featureColleagues = "ui_feature_colleagues"
    case publishComplaint = "ui_publish_complaint"
    case publishDynamic = "ui_publish_dynamic"
    case publishMood = "ui_publish_mood"
    case publishColleague = "ui_publish_colleague"
    case messageInteraction = "ui_message_interaction"
    case messageSystem = "ui_message_system"
    case messageAI = "ui_message_ai"
    case messageUpdate = "ui_message_update"
    case avatarAnonymous = "ui_avatar_anonymous"
    case profileComplaints = "ui_profile_complaints"
    case profileFavorites = "ui_profile_favorites"
    case profilePosts = "ui_profile_posts"
    case profileHistory = "ui_profile_history"
    case toolReport = "ui_tool_report"
    case toolAI = "ui_tool_ai"
    case toolStress = "ui_tool_stress"
    case toolRelationship = "ui_tool_relationship"
    case rowColleague = "ui_row_colleague"
    case rowCompany = "ui_row_company"
    case badgeLevel = "ui_badge_level"
    case appBackground = "ui_bg_app_soft"
    case homeHeroDecoration = "ui_decor_home_hero"

    var image: Image { Image(rawValue) }
}

struct UIAssetImage: View {
    let asset: UIAsset
    var size: CGFloat
    var tint: Color?

    init(_ asset: UIAsset, size: CGFloat, tint: Color? = nil) {
        self.asset = asset
        self.size = size
        self.tint = tint
    }

    var body: some View {
        asset.image
            .renderingMode(tint == nil ? .original : .template)
            .resizable()
            .scaledToFit()
            .foregroundStyle(tint ?? .primary)
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }
}
