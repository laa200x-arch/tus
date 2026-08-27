'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const L = require('./src/little-energy.js')

async function main() {
  const browser = vm.createContext({ console })
  browser.globalThis = browser
  vm.runInContext(fs.readFileSync('./src/little-energy.js', 'utf8'), browser, { filename: 'little-energy.js' })
  vm.runInContext('function api() {}; const { MOODS } = globalThis.LittleEnergy', browser, { filename: 'following-browser-scripts.js' })
  assert.equal(browser.LittleEnergy.MOODS.length, 27, 'browser scripts share only the exported LittleEnergy API without lexical collisions')

  const routed = []
  L.routeDataChange('home', {
    home: () => routed.push('home'),
    colleagues: () => routed.push('colleagues')
  })
  assert.deepEqual(routed, ['home'], 'home data changes preserve the home page and never render colleagues')

  // 首页五个快捷情绪必须落在共享 27 情绪目录的稳定 ID 上（首页聚合契约回归）
  const quickMoodIDs = ['xnz_motivated', 'xnz_composed', 'xnz_calm', 'xnz_tired', 'xnz_angry']
  for (const id of quickMoodIDs) {
    assert.equal(L.normalizeMood(id), id, `overview quick mood ${id} stays a stable catalog ID`)
    assert.ok(L.MOODS.some((m) => m.id === id), `overview quick mood ${id} exists in the 27-mood catalog`)
  }
  assert.equal(L.normalizeMood('😐'), 'xnz_calm', 'legacy emoji still normalizes through the shared catalog')

  const state = { moodToday: null }
  const hero = { innerHTML: 'old' }
  let moodCardRenders = 0
  L.applyMoodToday(state, { checked: true, mood: 'xnz_angry' }, {
    getElementById: (id) => id === 'home-little-energy' ? hero : null,
    renderAvatar: (mood) => `avatar:${mood}`,
    renderMoodCard: () => { moodCardRenders++ }
  })
  assert.equal(state.moodToday.mood, 'xnz_angry', 'loaded mood becomes the global same-day state')
  assert.equal(hero.innerHTML, 'avatar:xnz_angry', 'loaded mood refreshes the home hero')
  assert.equal(moodCardRenders, 1, 'loaded mood refreshes the mood card')

  const mine = { topId: 'top_jacket', bottomId: 'bottom_cargo', shoesId: 'shoes_boots', accessoryIds: ['accessory_hat'] }
  const sender = { topId: 'top_hoodie', bottomId: 'bottom_jeans', shoesId: 'shoes_canvas', accessoryIds: ['accessory_glasses'] }
  assert.deepEqual(L.messageOutfit({ senderIsMe: true }, sender, mine), L.normalizeOutfit(mine), 'outgoing emoji uses my outfit')
  assert.deepEqual(L.messageOutfit({ senderIsMe: false }, sender, mine), L.normalizeOutfit(sender), 'incoming emoji uses conversation partner outfit')
  assert.deepEqual(L.messageOutfit({ senderIsMe: false, senderOutfit: sender }, null, mine), L.normalizeOutfit(sender), 'message sender outfit wins when available')
  assert.deepEqual(L.messageOutfit({ senderIsMe: false }, null, mine), L.normalizeOutfit(null), 'incoming emoji safely defaults and never borrows my outfit')
  assert.notDeepEqual(L.messageOutfit({ senderIsMe: false }, null, mine), L.normalizeOutfit(mine))

  let drawCalls = 0
  const image = { complete: false, naturalWidth: 0, onload: null, onerror: null }
  const promise = L.loadCanvasImage('asset.png', () => image).then((loaded) => {
    drawCalls++
    assert.equal(loaded, image)
  })
  assert.equal(drawCalls, 0, 'canvas export waits for the Little Energy image')
  image.naturalWidth = 128
  image.onload()
  await promise
  assert.equal(drawCalls, 1)

  await assert.rejects(
    L.loadCanvasImage('missing.png', () => {
      const failed = { complete: false, naturalWidth: 0 }
      queueMicrotask(() => failed.onerror(new Error('missing')))
      return failed
    }),
    /missing\.png/,
    'asset load failure is explicit so the caller can use its fallback'
  )

  console.log('PASS | Windows Little Energy DOM/state, sender outfit and canvas loading regressions')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
