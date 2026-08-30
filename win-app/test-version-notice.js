'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const app = fs.readFileSync(path.join(__dirname, 'src', 'app.js'), 'utf8')
const views = fs.readFileSync(path.join(__dirname, 'src', 'views.js'), 'utf8')
const content = fs.readFileSync(path.join(root, 'TuS', 'App', 'ContentView.swift'), 'utf8')
const messages = fs.readFileSync(path.join(root, 'TuS', 'Views', 'Chat', 'MessageView.swift'), 'utf8')

assert.match(app, /storeVersionNotice\(/, 'Windows update checks must save a notice instead of interrupting the user')
assert.doesNotMatch(app, /openModal\(`<div class="modal-title">发现新版本/, 'Windows must not show a startup update modal')
assert.match(views, /renderVersionNoticePage\(/, 'Windows must provide a user-opened version notice page')
assert.match(messages, /VersionNoticeView/, 'iOS Messages must expose a version notice page')
assert.doesNotMatch(content, /\.alert\(\s*"发现新版本/, 'iOS must not show an update alert at launch')

console.log('PASS | Update checks create user-opened version notices')
