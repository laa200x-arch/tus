const assert = require('assert')
const fs = require('fs')
const path = require('path')

const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf8')
const littleEnergy = fs.readFileSync(path.join(__dirname, 'src', 'little-energy.js'), 'utf8')
const completeDir = path.join(__dirname, 'assets', 'little-energy', 'complete')

assert.match(littleEnergy, /function completeAvatarAsset\(/, 'complete-avatar resolver is required')
assert.match(littleEnergy, /little-energy-complete/, 'avatar markup must render one complete image')
assert.doesNotMatch(littleEnergy, /layer-emotion-head/, 'avatar markup must not layer a full emotion body over clothing')
assert.doesNotMatch(css, /\.little-energy-avatar \.layer-(emotion-head|look)\s*\{/, 'CSS must not retain two full-body avatar layers')
assert.ok(fs.existsSync(path.join(completeDir, 'xnz_happy-commute-front.png')), 'precomposed happy commute avatar must exist')

console.log('PASS | Little Energy avatars use one complete precomposed asset')
