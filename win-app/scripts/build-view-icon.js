'use strict'

const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const phosphor = require('@iconify-json/ph/icons.json')

const root = path.resolve(__dirname, '..', '..')
const body = phosphor.icons.eye.body.replaceAll('currentColor', '#747B96')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><g fill="#747B96">${body}</g></svg>`

async function main() {
  const output = path.join(root, 'assets', 'ui', 'icons', 'ui_action_view.png')
  fs.mkdirSync(path.dirname(output), { recursive: true })
  await sharp(Buffer.from(svg)).resize(200, 200, { fit: 'contain' }).extend({ top: 28, bottom: 28, left: 28, right: 28, background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(output)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
