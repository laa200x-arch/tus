const UI_ASSET_ROOT = '../assets/ui/'

const UI_ASSET = Object.freeze({
  brandTuS: 'icons/ui_brand_tus.png',
  navHome: 'icons/ui_nav_home.png',
  navPlaza: 'icons/ui_nav_plaza.png',
  navPublish: 'icons/ui_nav_publish.png',
  navMessages: 'icons/ui_nav_messages.png',
  navProfile: 'icons/ui_nav_profile.png',
  actionSearch: 'icons/ui_action_search.png',
  actionBack: 'icons/ui_action_back.png',
  actionMore: 'icons/ui_action_more.png',
  actionChevron: 'icons/ui_action_chevron.png',
  actionLike: 'icons/ui_action_like.png',
  actionView: 'icons/ui_action_view.png',
  actionComment: 'icons/ui_action_comment.png',
  actionShare: 'icons/ui_action_share.png',
  actionSend: 'icons/ui_action_send.png',
  actionAdd: 'icons/ui_action_add.png',
  featureCheckin: 'icons/ui_feature_checkin.png',
  featurePlaza: 'icons/ui_feature_plaza.png',
  featureMyComplaints: 'icons/ui_feature_my_complaints.png',
  featureColleagues: 'icons/ui_feature_colleagues.png',
  publishComplaint: 'icons/ui_publish_complaint.png',
  publishDynamic: 'icons/ui_publish_dynamic.png',
  publishMood: 'icons/ui_publish_mood.png',
  publishColleague: 'icons/ui_publish_colleague.png',
  messageInteraction: 'icons/ui_message_interaction.png',
  messageSystem: 'icons/ui_message_system.png',
  messageAI: 'icons/ui_message_ai.png',
  messageUpdate: 'icons/ui_message_update.png',
  avatarAnonymous: 'icons/ui_avatar_anonymous.png',
  profileComplaints: 'icons/ui_profile_complaints.png',
  profileFavorites: 'icons/ui_profile_favorites.png',
  profilePosts: 'icons/ui_profile_posts.png',
  profileHistory: 'icons/ui_profile_history.png',
  toolReport: 'icons/ui_tool_report.png',
  toolAI: 'icons/ui_tool_ai.png',
  toolStress: 'icons/ui_tool_stress.png',
  toolRelationship: 'icons/ui_tool_relationship.png',
  rowColleague: 'icons/ui_row_colleague.png',
  rowCompany: 'icons/ui_row_company.png',
  badgeLevel: 'icons/ui_badge_level.png',
  appBackground: 'backgrounds/ui_bg_app_soft.png',
  homeHeroDecoration: 'backgrounds/ui_decor_home_hero.png'
})

function uiAsset(name) {
  const relativePath = UI_ASSET[name]
  if (!relativePath) throw new Error(`Unknown UI asset: ${name}`)
  return `${UI_ASSET_ROOT}${relativePath}`
}

function uiAssetImg(name, className = '', alt = '') {
  return `<img class="ui-asset ${className}" src="${uiAsset(name)}" alt="${alt}">`
}

window.UI_ASSET = UI_ASSET
window.uiAsset = uiAsset
window.uiAssetImg = uiAssetImg
