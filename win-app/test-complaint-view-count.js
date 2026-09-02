'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const serverSchema = read('server/src/schema.js')
const serverRoutes = read('server/src/routes/complaints.js')
assert.match(serverSchema, /CREATE TABLE IF NOT EXISTS complaint_views/, 'viewers need a persistent unique-view table')
assert.match(serverRoutes, /viewCount/, 'complaint API must return viewCount')
assert.match(serverRoutes, /INSERT INTO complaint_views/, 'opening a detail page should record a viewer')

const windowsAssets = read('win-app/src/ui-assets.js')
const windowsViews = read('win-app/src/views.js')
assert.match(windowsAssets, /actionView:\s*'icons\/ui_action_view\.png'/, 'Windows needs the unified eye asset')
assert.match(windowsViews, /data-vc/, 'Windows complaint card should render the view count')
assert.match(windowsViews, /uiAssetImg\('actionView'/, 'Windows complaint card should use the eye asset')

const swiftModel = read('TuS/Models/AgreementModel.swift')
const swiftView = read('TuS/Views/Feed/ExchangeDynamicView.swift')
assert.match(swiftModel, /var viewCount: Int = 0/, 'iOS must decode older responses with a zero view-count fallback')
assert.match(swiftView, /UIAssetImage\(\.actionView/, 'iOS complaint card should use the shared eye asset')

for (const file of [
  'win-app/assets/ui/icons/ui_action_view.png',
  'TuS/Assets.xcassets/UI/Icons/ui_action_view.imageset/ui_action_view.png',
  'TuS/Assets.xcassets/UI/Icons/ui_action_view.imageset/Contents.json'
]) assert.ok(fs.existsSync(path.join(root, file)), `missing view-count icon asset: ${file}`)

console.log('PASS | Complaint view-count data and cross-platform presentation contracts are present')
