const assert = require('assert')
const fs = require('fs')
const path = require('path')

const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.') }\\s*\\{([^}]*)\\}`))
  assert.ok(match, `missing ${selector} layer rule`)
  return match[1]
}

const emotion = rule('.little-energy-avatar .layer-emotion-head')
const look = rule('.little-energy-avatar .layer-look')

assert.match(emotion, /z-index:\s*2/, 'emotion head must remain above the complete look shell')
assert.match(emotion, /clip-path:\s*inset\(0\s+0\s+40%\s+0\)/, 'emotion must be cropped to its head region')
assert.match(look, /z-index:\s*1/, 'one complete look shell must sit beneath the cropped emotion head')
assert.doesNotMatch(css, /\.little-energy-avatar \.layer-(top|bottom|shoes|accessory)\s*\{/, 'no product-cutout layers may remain in the avatar CSS')

console.log('PASS | Little Energy avatars render one complete look above the emotion base')
