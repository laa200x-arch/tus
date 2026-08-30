'use strict'

const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')

const workspaceRoot = path.resolve(__dirname, '..', '..')
const source = process.argv[2]
if (!source) throw new Error('Usage: node scripts/build-app-icons.js <approved-source-png>')

const targets = [
  [1024, path.join(workspaceRoot, 'TuS', 'Assets.xcassets', 'AppIcon.appiconset', 'AppIcon.png')],
  [512, path.join(workspaceRoot, 'assets', 'branding', 'tus-office-app-icon.png')],
  [512, path.join(workspaceRoot, 'win-app', 'assets', 'branding', 'tus-office-app-icon.png')],
  [256, path.join(workspaceRoot, 'assets', 'ui', 'icons', 'ui_brand_tus.png')],
  [256, path.join(workspaceRoot, 'win-app', 'assets', 'ui', 'icons', 'ui_brand_tus.png')]
]

function icoFromPngs(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(entries.length, 4)
  const directory = Buffer.alloc(entries.length * 16)
  let offset = header.length + directory.length
  entries.forEach(({ size, png }, index) => {
    const base = index * 16
    directory[base] = size === 256 ? 0 : size
    directory[base + 1] = size === 256 ? 0 : size
    directory.writeUInt16LE(1, base + 4); directory.writeUInt16LE(32, base + 6)
    directory.writeUInt32LE(png.length, base + 8); directory.writeUInt32LE(offset, base + 12)
    offset += png.length
  })
  return Buffer.concat([header, directory, ...entries.map((entry) => entry.png)])
}

async function main() {
  for (const [, file] of targets) await fs.promises.mkdir(path.dirname(file), { recursive: true })
  const normalized = sharp(source).flatten({ background: '#faf9ff' })
  for (const [size, file] of targets) {
    const output = file.endsWith('ui_brand_tus.png')
      ? sharp(source).resize(size - 56, size - 56, { fit: 'contain' }).extend({ top: 28, bottom: 28, left: 28, right: 28, background: { r: 0, g: 0, b: 0, alpha: 0 } }).ensureAlpha()
      : normalized.clone().resize(size, size, { fit: 'cover' })
    await output.png().toFile(file)
  }
  const icoEntries = await Promise.all([16, 32, 48, 64, 128, 256].map(async (size) => ({
    size,
    png: await normalized.clone().resize(size, size, { fit: 'cover' }).png().toBuffer()
  })))
  const iconFile = path.join(workspaceRoot, 'win-app', 'build', 'icon.ico')
  await fs.promises.mkdir(path.dirname(iconFile), { recursive: true })
  await fs.promises.writeFile(iconFile, icoFromPngs(icoEntries))
  console.log('Generated iOS, Windows, launch and packaged icon derivatives.')
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
