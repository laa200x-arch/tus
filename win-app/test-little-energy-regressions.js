'use strict'

const assert = require('node:assert/strict')
const L = require('./src/little-energy.js')

async function main() {
  const routed = []
  L.routeDataChange('home', {
    home: () => routed.push('home'),
    colleagues: () => routed.push('colleagues')
  })
  assert.deepEqual(routed, ['home'], 'home data changes preserve the home page and never render colleagues')

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
