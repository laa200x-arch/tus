import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { MOODS, normalizeMood, normalizeOutfit, isLittleEnergyEmoji } from '../src/little-energy.js'

assert.equal(MOODS.length, 27)
assert.equal(new Set(MOODS.map((m) => m.id)).size, 27)
assert.equal(normalizeMood('😄'), 'xnz_happy')
assert.equal(normalizeMood('😐'), 'xnz_calm')
assert.equal(normalizeMood('xnz_angry'), 'xnz_angry')
assert.equal(normalizeMood('unknown'), 'xnz_happy')
assert.deepEqual(normalizeOutfit({ topId: 'bad' }), {
  topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: []
})
assert.equal(isLittleEnergyEmoji('xnz_grateful'), true)
assert.equal(isLittleEnergyEmoji('../bad.png'), false)

const verifier = spawnSync(process.execPath, ['../tools/verify-little-energy-assets.mjs', '--catalog-only'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8'
})
assert.equal(verifier.status, 0, verifier.stderr)

console.log('Little Energy catalog: 27 moods; normalization and catalog-only verification passed.')
