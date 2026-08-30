;(function (root) {
'use strict'

// IDs mirror shared/little-energy/catalog.json and the server contract.
const MOOD_ROWS = [
  ['xnz_happy', '开心', '😄', 3], ['xnz_joyful', '快乐', null, 3],
  ['xnz_calm', '平静', '😐', 1], ['xnz_excited', '兴奋', null, 3],
  ['xnz_proud', '自豪', null, 3], ['xnz_love', '爱心', null, 3],
  ['xnz_grateful', '感激', null, 3], ['xnz_expectant', '期待', null, 2],
  ['xnz_surprised', '惊讶', null, 0], ['xnz_worried', '担忧', null, -1],
  ['xnz_anxious', '焦虑', null, -2], ['xnz_tired', '疲惫', '😮‍💨', -2],
  ['xnz_stressed', '压力大', null, -3], ['xnz_sad', '难过', '💀', -3],
  ['xnz_disappointed', '失望', null, -2], ['xnz_lonely', '孤独', null, -3],
  ['xnz_irritated', '烦躁', null, -2], ['xnz_angry', '愤怒', '😡', -3],
  ['xnz_jealous', '嫉妒', null, -2], ['xnz_embarrassed', '尴尬', null, -1],
  ['xnz_guilty', '愧疚', null, -2], ['xnz_confused', '困惑', null, -1],
  ['xnz_shocked', '震惊', null, -1], ['xnz_determined', '坚定', null, 2],
  ['xnz_motivated', '斗志', null, 3], ['xnz_composed', '从容', '🙂', 1],
  ['xnz_sleepy', '困倦', null, -2]
]

const MOODS = Object.freeze(MOOD_ROWS.map(([id, label, legacyEmoji, score]) => Object.freeze({
  id, label, legacyEmoji, score, assetName: id, fallbackText: `[小能仔·${label}]`
})))
const OUTFIT_CATALOG = Object.freeze({
  tops: Object.freeze(['top_tshirt', 'top_hoodie', 'top_shirt', 'top_sweater', 'top_jacket']),
  bottoms: Object.freeze(['bottom_slacks', 'bottom_jeans', 'bottom_cargo', 'bottom_shorts', 'bottom_skirt']),
  shoes: Object.freeze(['shoes_sneakers', 'shoes_canvas', 'shoes_leather', 'shoes_boots', 'shoes_casual']),
  accessories: Object.freeze(['accessory_glasses', 'accessory_hat', 'accessory_headphones', 'accessory_watch', 'accessory_necklace', 'accessory_ring', 'accessory_bracelet', 'accessory_backpack', 'accessory_tote_bag', 'accessory_crossbody_bag', 'accessory_belt', 'accessory_hairclip'])
})
const DEFAULT_OUTFIT = Object.freeze({ topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: Object.freeze([]) })
const LOOKS = Object.freeze([
  Object.freeze({ id: 'commute', label: '简约通勤', outfit: DEFAULT_OUTFIT }),
  Object.freeze({ id: 'casual', label: '休闲卫衣', outfit: Object.freeze({ topId: 'top_hoodie', bottomId: 'bottom_cargo', shoesId: 'shoes_canvas', accessoryIds: Object.freeze([]) }) }),
  Object.freeze({ id: 'professional', label: '职场精英', outfit: Object.freeze({ topId: 'top_shirt', bottomId: 'bottom_slacks', shoesId: 'shoes_leather', accessoryIds: Object.freeze([]) }) }),
  Object.freeze({ id: 'campus', label: '学院风', outfit: Object.freeze({ topId: 'top_sweater', bottomId: 'bottom_shorts', shoesId: 'shoes_sneakers', accessoryIds: Object.freeze(['accessory_crossbody_bag']) }) }),
  Object.freeze({ id: 'street', label: '都市潮酷', outfit: Object.freeze({ topId: 'top_jacket', bottomId: 'bottom_cargo', shoesId: 'shoes_boots', accessoryIds: Object.freeze(['accessory_hat', 'accessory_crossbody_bag']) }) })
])
const moodById = new Map(MOODS.map((m) => [m.id, m]))
const legacyMoodIds = new Map(MOODS.filter((m) => m.legacyEmoji).map((m) => [m.legacyEmoji, m.id]))

function normalizeMood(value) {
  return moodById.has(value) ? value : (legacyMoodIds.get(value) || DEFAULT_MOOD_ID)
}
const DEFAULT_MOOD_ID = 'xnz_happy'

function normalizeOutfit(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  const valid = (group, id, fallback) => OUTFIT_CATALOG[group].includes(id) ? id : fallback
  return {
    topId: valid('tops', source.topId, DEFAULT_OUTFIT.topId),
    bottomId: valid('bottoms', source.bottomId, DEFAULT_OUTFIT.bottomId),
    shoesId: valid('shoes', source.shoesId, DEFAULT_OUTFIT.shoesId),
    accessoryIds: [...new Set(Array.isArray(source.accessoryIds) ? source.accessoryIds : [])]
      .filter((id) => OUTFIT_CATALOG.accessories.includes(id))
  }
}

function resolveLook(value) {
  const outfit = normalizeOutfit(value)
  const id = ({ top_hoodie: 'casual', top_shirt: 'professional', top_sweater: 'campus', top_jacket: 'street' })[outfit.topId] || 'commute'
  return LOOKS.find((look) => look.id === id) || LOOKS[0]
}

function assetPath(path) { return `../assets/little-energy/${path}` }
function completeAvatarAsset(moodId, outfit) {
  const mood = moodById.get(normalizeMood(moodId))
  const look = resolveLook(outfit)
  return assetPath(`complete/${mood.id}-${look.id}-front.png`)
}
function littleEnergyAvatarHtml({ moodId, outfit, role = 'user', className = '' } = {}) {
  if (role === 'darkColleague') {
    return `<div class="little-energy-avatar dark-colleague ${className}" aria-label="被吐槽同事小能仔"><img src="${assetPath('colleague/dark-colleague.png')}" alt=""></div>`
  }
  const mood = moodById.get(normalizeMood(moodId))
  const look = resolveLook(outfit)
  return `<div class="little-energy-avatar ${className}" data-mood="${mood.id}" data-look="${look.id}" aria-label="小能仔·${mood.label}，${look.label}"><img class="little-energy-complete" src="${completeAvatarAsset(mood.id, look.outfit)}" alt=""></div>`
}

function littleEnergyEmojiPayload(id) {
  const mood = moodById.get(id)
  return mood ? { text: mood.fallbackText, mediaType: 'little_energy_emoji', mediaUrl: mood.id } : null
}

function compatibleMoodPayload(value) { return normalizeMood(value) }

// Older production servers only understand the six original Emoji moods. Keep
// the selected 27-mood state in the client, but send the nearest stable legacy
// value when a server has not been upgraded yet.
function legacyMoodPayload(value) {
  const mood = moodById.get(normalizeMood(value))
  if (mood.legacyEmoji) return mood.legacyEmoji
  if (mood.score >= 2) return '😄'
  if (mood.score >= 1) return '🙂'
  if (mood.score <= -3) return '😡'
  if (mood.score <= -2) return '😮‍💨'
  return '😐'
}

function userAvatarHtml(user, { className = '', moodId } = {}) {
  const anonymous = Boolean(user && user.isAnonymous)
  return littleEnergyAvatarHtml({
    moodId: anonymous ? 'xnz_calm' : (moodId || (user && (user.moodId || user.mood))),
    outfit: anonymous ? DEFAULT_OUTFIT : (user && user.littleEnergyOutfit),
    className
  })
}

function personalityTitle(value) {
  return String(value || '').replace(/^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u, '').trim()
}

function messageOutfit(message, partnerOutfit, currentUserOutfit) {
  if (message && message.senderIsMe) return normalizeOutfit(currentUserOutfit)
  return normalizeOutfit((message && message.senderOutfit) || partnerOutfit)
}

function applyMoodToday(state, today, { getElementById, renderAvatar, renderMoodCard } = {}) {
  state.moodToday = today
  const hero = getElementById && getElementById('home-little-energy')
  if (hero && renderAvatar) hero.innerHTML = renderAvatar(normalizeMood(today && today.mood))
  if (renderMoodCard) renderMoodCard()
  return today
}

function routeDataChange(currentView, renderers = {}) {
  if (currentView === 'status') return renderers.status && renderers.status()
  if (currentView === 'colleague') return renderers.colleagues && renderers.colleagues()
  if (currentView === 'home') return renderers.home && renderers.home()
  if (currentView === 'mine') return renderers.mine && renderers.mine()
}

function littleEnergyAssetSources(moodId, outfit) { return [completeAvatarAsset(moodId, outfit)] }

function loadCanvasImage(src, imageFactory = () => new Image()) {
  return new Promise((resolve, reject) => {
    const img = imageFactory()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Unable to load Little Energy asset: ${src}`))
    img.src = src
    if (img.complete && img.naturalWidth > 0) resolve(img)
  })
}

const api = {
  MOODS, OUTFIT_CATALOG, DEFAULT_OUTFIT, LOOKS, normalizeMood, normalizeOutfit, resolveLook, completeAvatarAsset,
  littleEnergyAvatarHtml, littleEnergyEmojiPayload, messageOutfit, applyMoodToday,
  routeDataChange, littleEnergyAssetSources, loadCanvasImage, userAvatarHtml,
  personalityTitle, compatibleMoodPayload, legacyMoodPayload
}
if (typeof module !== 'undefined' && module.exports) module.exports = api
if (root) root.LittleEnergy = api
})(typeof globalThis !== 'undefined' ? globalThis : this)
