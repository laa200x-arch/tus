'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = __dirname
const L = require('./src/little-energy.js')
const apiSource = fs.readFileSync(path.join(root, 'src', 'api.js'), 'utf8')
const viewsSource = fs.readFileSync(path.join(root, 'src', 'views.js'), 'utf8')
const htmlSource = fs.readFileSync(path.join(root, 'src', 'index.html'), 'utf8')
const styleSource = fs.readFileSync(path.join(root, 'src', 'style.css'), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
const sharedCatalog = JSON.parse(fs.readFileSync(path.join(root, '..', 'shared', 'little-energy', 'catalog.json'), 'utf8'))

assert.equal(L.MOODS.length, 27, 'catalog has 27 moods')
assert.equal(new Set(L.MOODS.map((m) => m.id)).size, 27, 'mood IDs are unique')
assert.deepEqual(L.MOODS, sharedCatalog.moods, 'Windows mood catalog matches shared IDs and metadata')
assert.deepEqual(L.OUTFIT_CATALOG, sharedCatalog.outfits, 'Windows outfit catalog matches shared IDs')
assert.equal(L.normalizeMood('😄'), 'xnz_happy', 'legacy mood normalized')
assert.equal(L.normalizeMood('../bad.png'), 'xnz_happy', 'unknown mood falls back safely')

const defaultOutfit = L.normalizeOutfit({ topId: '../bad', accessoryIds: ['accessory_hat', '../../x'] })
assert.deepEqual(defaultOutfit, {
  topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: ['accessory_hat']
})

const userHtml = L.littleEnergyAvatarHtml({
  moodId: 'xnz_angry',
  outfit: { topId: 'top_hoodie', bottomId: 'bottom_jeans', shoesId: 'shoes_canvas', accessoryIds: ['accessory_hat'] }
})
assert.match(userHtml, /xnz_angry\.png/)
assert.match(userHtml, /top_hoodie\.png/)
assert.doesNotMatch(userHtml, /dark-colleague\.png/)

const darkHtml = L.littleEnergyAvatarHtml({ role: 'darkColleague' })
assert.match(darkHtml, /dark-colleague\.png/)
assert.doesNotMatch(darkHtml, /outfits\//, 'dark colleague never receives outfit layers')

assert.deepEqual(L.littleEnergyEmojiPayload('xnz_happy'), {
  text: '[小能仔·开心]', mediaType: 'little_energy_emoji', mediaUrl: 'xnz_happy'
})
assert.equal(L.littleEnergyEmojiPayload('../bad'), null)

const dressedAvatar = L.userAvatarHtml({ littleEnergyOutfit: { topId: 'top_hoodie' }, mood: 'xnz_angry' }, { className: 'avatar-sm' })
assert.match(dressedAvatar, /xnz_angry\.png/)
assert.match(dressedAvatar, /top_hoodie\.png/)
assert.doesNotMatch(dressedAvatar, /avatarSymbol|👤/)
const anonymousAvatar = L.userAvatarHtml({ isAnonymous: true, littleEnergyOutfit: { topId: 'top_hoodie' } })
assert.match(anonymousAvatar, /data-mood="xnz_calm"/)
assert.match(anonymousAvatar, /top_tshirt\.png/, 'anonymous avatar is deterministic and does not leak outfit')
assert.equal(L.personalityTitle('🐟 摸鱼哲学家'), '摸鱼哲学家')
assert.equal(L.personalityTitle('✨ 可靠同盟'), '可靠同盟')
assert.equal(L.compatibleMoodPayload('😡'), 'xnz_angry')
assert.equal(L.compatibleMoodPayload('xnz_sleepy'), 'xnz_sleepy')

assert.match(apiSource, /littleEnergyOutfit/, 'profile API includes outfit')
assert.match(apiSource, /App\.state\.moodToday\s*=\s*data/, 'check-in updates global same-day state')
assert.match(viewsSource, /littleEnergyEmojiPayload/, 'chat uses stable emoji payload helper')
assert.match(viewsSource, /role:\s*['"]darkColleague['"]/, 'colleague visuals explicitly use dark role')
assert.match(htmlSource, /little-energy\.js/, 'catalog/renderer loads before views')
assert.ok(packageJson.build.files.includes('assets/**/*'), 'Windows package contains local character assets')
assert.doesNotMatch(viewsSource, /STATUS_MOODS|data-emoji=|p\.emoji|🐟 摸鱼哲学家/, 'legacy visible mood/personality emoji paths are removed')
assert.doesNotMatch(viewsSource, /state\.avatarSymbol|头像（照片或符号）/, 'colleague editor is photo or fixed dark colleague')
assert.match(viewsSource, /complaint-avatar[^\n]+avatarHtml\(c/, 'complaints use common Little Energy avatar')
assert.match(viewsSource, /cmt-avatar[^\n]+avatarHtml\(m/, 'comments use common Little Energy avatar')
for (const className of ['little-energy-feed-avatar', 'little-energy-comment-avatar', 'little-energy-saved-avatar']) {
  assert.match(styleSource, new RegExp(`\\.${className}\\s*\\{`), `${className} has an explicit compact layout`)
}

console.log('PASS | Windows Little Energy catalog, state, renderer, outfit and emoji contracts')
