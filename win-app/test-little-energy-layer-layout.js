const assert = require('assert')
const fs = require('fs')
const path = require('path')

const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8')

function rule(selector) {
  const match = css.match(new RegExp(`${selector.replace('.', '\\.') }\\s*\\{([^}]*)\\}`))
  assert.ok(match, `missing ${selector} layer rule`)
  return match[1]
}

const emotion = rule('.little-energy-avatar .layer-emotion')
const look = rule('.little-energy-avatar .layer-look')

assert.match(emotion, /z-index:\s*1/, 'emotion base must stay visible behind clothes')
assert.match(look, /z-index:\s*2/, 'one complete look shell must sit above the mood base')
assert.doesNotMatch(css, /\.little-energy-avatar \.layer-(top|bottom|shoes|accessory)\s*\{/, 'no product-cutout layers may remain in the avatar CSS')

console.log('PASS | Little Energy avatars render one complete look above the emotion base')
