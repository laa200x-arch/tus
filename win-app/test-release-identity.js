'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'))
const main = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8')
const project = fs.readFileSync(path.join(root, 'TuS.xcodeproj', 'project.pbxproj'), 'utf8')
const icon = path.join(__dirname, 'build', 'icon.ico')

assert.equal(pkg.build.win.icon, 'build/icon.ico', 'Windows installer/executable must use the unified icon')
assert.match(main, /icon:\s*appIconPath/, 'Windows window must use the unified icon')
assert.doesNotMatch(main, /nativeImage\.createEmpty\(\)/, 'Windows tray must not be blank')
assert.ok(fs.existsSync(icon), 'multi-size Windows icon must exist')
assert.match(project, /MARKETING_VERSION = 2\.1\.7;/, 'iOS release version must match the current release')

console.log('PASS | Application identity and release metadata are unified')
