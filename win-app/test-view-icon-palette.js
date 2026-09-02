'use strict'

const assert = require('node:assert/strict')
const path = require('node:path')
const sharp = require('sharp')

async function main() {
  const file = path.join(__dirname, '..', 'assets', 'ui', 'icons', 'ui_action_view.png')
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  let visible = 0
  let matchesPalette = 0
  for (let offset = 0; offset < data.length; offset += info.channels) {
    if (data[offset + 3] < 128) continue
    visible += 1
    if (Math.abs(data[offset] - 116) <= 2 && Math.abs(data[offset + 1] - 123) <= 2 && Math.abs(data[offset + 2] - 150) <= 2) matchesPalette += 1
  }
  assert.ok(visible > 0, 'view icon must have visible pixels')
  assert.ok(matchesPalette / visible > 0.98, 'view icon should use the shared #747B96 action-icon color')
  console.log('PASS | View icon uses the shared action-icon palette')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
