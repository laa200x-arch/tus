'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'scripts', 'build-complete-avatars.js'), 'utf8')

assert.match(source, /const faceScale = 0\.86/, 'Complete avatar build must reduce face art below the look face panel')
assert.match(source, /left: target\.left \+ Math\.round\(\(target\.width - faceWidth\) \/ 2\)/, 'Reduced face art must remain centered')

console.log('PASS | Complete avatar face art is scaled and centered')
