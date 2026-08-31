'use strict'

const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const source = process.argv[2]
if (!source || !fs.existsSync(source)) throw new Error('Usage: node scripts/build-exit-confirm-assets.js <reference-image>')

const output = path.join(__dirname, '..', 'assets', 'branding')
fs.mkdirSync(output, { recursive: true })

async function writeCrop(name, left, top, width, height) {
  const { data, info } = await sharp(source)
    .extract({ left, top, width, height })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  // Remove only the pale background connected to the crop edge. This keeps the
  // mascot's white face and the icons' inner highlights intact.
  const seen = new Uint8Array(info.width * info.height)
  const queue = []
  const isBackground = (index) => data[index * 4] > 246 && data[index * 4 + 1] > 246 && data[index * 4 + 2] > 246
  const visit = (x, y) => {
    const point = y * info.width + x
    if (seen[point] || !isBackground(point)) return
    seen[point] = 1
    queue.push(point)
  }
  for (let x = 0; x < info.width; x++) { visit(x, 0); visit(x, info.height - 1) }
  for (let y = 0; y < info.height; y++) { visit(0, y); visit(info.width - 1, y) }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const point = queue[cursor]
    const x = point % info.width
    const y = Math.floor(point / info.width)
    data[point * 4 + 3] = 0
    if (x > 0) visit(x - 1, y)
    if (x + 1 < info.width) visit(x + 1, y)
    if (y > 0) visit(x, y - 1)
    if (y + 1 < info.height) visit(x, y + 1)
  }
  await sharp(data, { raw: info }).png().toFile(path.join(output, name))
}

async function main() {
  // Coordinates are tied to the supplied 1400 × 1080 visual material sheet.
  await writeCrop('exit-confirm-mascot.png', 78, 30, 440, 445)
  await writeCrop('exit-confirm-tray.png', 635, 180, 150, 145)
  await writeCrop('exit-confirm-quit.png', 900, 175, 175, 150)
  await writeCrop('exit-confirm-close.png', 1195, 180, 120, 130)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
