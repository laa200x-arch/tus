'use strict'

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const root = __dirname
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

const views = read('src/views.js')
assert.match(
  views,
  /onDataChanged:\s*\(\)\s*=>\s*\{[\s\S]{0,180}routeDataChange\(App\.views\.current,/,
  'mood-save rerender must read the registered view state, not the undefined App.state.views object'
)
assert.doesNotMatch(views, /App\.state\.views\.current/, 'view routing must not read App.state.views.current')

const api = read('src/api.js')
assert.doesNotMatch(api, /App\.state\.views/, 'data refresh and message callbacks must use App.views, the registered view API')

const main = read('main.js')
assert.doesNotMatch(main, /showMessageBoxSync/, 'desktop close confirmation must be rendered in-app so it can match the design')
assert.match(main, /webContents\.send\('tus:request-close'\)/, 'window close should ask the renderer to display the custom confirmation')
assert.match(main, /ipcMain\.handle\('tus:hide-to-tray'/, 'renderer needs a safe minimize-to-tray action')
assert.match(main, /ipcMain\.handle\('tus:quit-app'/, 'renderer needs a safe quit action')

const preload = read('preload.js')
assert.match(preload, /onRequestClose/, 'preload should expose the close request event')
assert.match(preload, /hideToTray/, 'preload should expose minimize-to-tray')
assert.match(preload, /quitApp/, 'preload should expose quit')

const app = read('src/app.js')
assert.match(app, /exit-confirm-modal/, 'renderer should include the designed exit confirmation modal')

for (const asset of ['exit-confirm-mascot.png', 'exit-confirm-tray.png', 'exit-confirm-quit.png', 'exit-confirm-close.png']) {
  assert.ok(fs.existsSync(path.join(root, 'assets', 'branding', asset)), `${asset} should be a packaged PNG asset`)
}

Promise.all(['exit-confirm-mascot.png', 'exit-confirm-tray.png', 'exit-confirm-quit.png', 'exit-confirm-close.png'].map(async (asset) => {
  const { data, info } = await sharp(path.join(root, 'assets', 'branding', asset)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  assert.equal(data[3], 0, `${asset} should have a transparent outer corner instead of a white source rectangle`)
  assert.equal(info.channels, 4, `${asset} should retain an alpha channel`)
})).then(() => console.log('PASS | Windows mood refresh and exit confirmation contracts are present'))
