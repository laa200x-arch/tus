'use strict'

const assert = require('node:assert/strict')
const L = require('./src/little-energy.js')

for (const mood of L.MOODS) {
  const payload = L.legacyMoodPayload(mood.id)
  assert.match(payload, /^(😄|🙂|😐|😮‍💨|😡|💀)$/, `${mood.id} needs a legacy-server compatible fallback`)
}
assert.equal(L.legacyMoodPayload('xnz_motivated'), '😄')
assert.equal(L.legacyMoodPayload('xnz_tired'), '😮‍💨')
assert.equal(L.legacyMoodPayload('xnz_angry'), '😡')

console.log('PASS | Every Little Energy mood has a legacy server fallback')
