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
const top = rule('.little-energy-avatar .layer-top')
const bottom = rule('.little-energy-avatar .layer-bottom')
const shoes = rule('.little-energy-avatar .layer-shoes')

assert.match(emotion, /z-index:\s*1/, 'emotion base must stay visible behind clothes')
assert.match(top, /z-index:\s*2/, 'top layer must be above the base')
assert.match(bottom, /z-index:\s*3/, 'bottom layer must be above the top')
assert.match(shoes, /z-index:\s*4/, 'shoes layer must be above the bottom')
assert.match(top, /transform:\s*translateY\([^)]*\)\s*scale\(/, 'top must be visually aligned to the mascot body')
assert.match(bottom, /transform:\s*translateY\([^)]*\)\s*scale\(/, 'bottom must be visually aligned to the mascot body')
assert.match(shoes, /transform:\s*translateY\([^)]*\)\s*scale\(/, 'shoes must be visually aligned to the mascot body')

console.log('PASS | Little Energy clothing layers preserve the emotion base and calibrated body alignment')
