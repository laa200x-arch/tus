'use strict'

// Builds one complete Little Energy image for every mood/look pair. Source
// emotion files contain a full body, so only their facial panel is blended
// into a complete look during the build; runtime never stacks two bodies.
const fs = require('node:fs')
const path = require('node:path')
const sharp = require('sharp')
const { MOODS, LOOKS } = require('../src/little-energy.js')

const appRoot = path.resolve(__dirname, '..')
const workspaceRoot = path.resolve(appRoot, '..')
const emotionRoot = path.join(appRoot, 'assets', 'little-energy', 'emotions')
const lookRoot = path.join(appRoot, 'assets', 'little-energy', 'looks')
const winOutput = path.join(appRoot, 'assets', 'little-energy', 'complete')
const iosOutput = path.join(workspaceRoot, 'TuS', 'Assets.xcassets', 'LittleEnergy', 'complete')
// These bounds deliberately exclude the purple helmet and body from the mood
// art. Only the expression-bearing white facial panel is transferred.
function assetName(moodID, lookID) { return `${moodID}-${lookID}-front` }

async function faceBounds(file, expectedY) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  const visited = new Uint8Array(width * height)
  const candidates = []
  const isFaceWhite = (index) => {
    const r = data[index], g = data[index + 1], b = data[index + 2], a = data[index + 3]
    return a > 220 && r > 180 && g > 170 && b > 170 && Math.max(r, g, b) - Math.min(r, g, b) < 60
  }
  for (let start = 0; start < width * height; start++) {
    if (visited[start]) continue
    const index = start * channels
    if (!isFaceWhite(index)) { visited[start] = 1; continue }
    const queue = [start]
    visited[start] = 1
    let count = 0, minX = width, maxX = 0, minY = height, maxY = 0
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const point = queue[cursor], x = point % width, y = Math.floor(point / width)
      count++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
      for (const next of [point - 1, point + 1, point - width, point + width]) {
        if (next < 0 || next >= width * height || visited[next]) continue
        const nx = next % width
        if ((next === point - 1 || next === point + 1) && Math.floor(next / width) !== y) continue
        if (isFaceWhite(next * channels)) { visited[next] = 1; queue.push(next) } else visited[next] = 1
      }
    }
    if (count < 600) continue
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
    candidates.push({ left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1, count, score: Math.abs(cx - width / 2) + Math.abs(cy - height * expectedY) })
  }
  const face = candidates.sort((a, b) => a.score - b.score || b.count - a.count)[0]
  if (!face) throw new Error(`Unable to find face panel in ${file}`)
  const padding = 4
  return {
    left: Math.max(0, face.left - padding), top: Math.max(0, face.top - padding),
    width: Math.min(width - Math.max(0, face.left - padding), face.width + padding * 2),
    height: Math.min(height - Math.max(0, face.top - padding), face.height + padding * 2)
  }
}

async function facePanel(file, target) {
  const crop = await faceBounds(file, 0.48)
  const { data, info } = await sharp(file).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const rx = Math.max(1, crop.width / 2 - 2), ry = Math.max(1, crop.height / 2 - 2)
  for (let y = 0; y < crop.height; y++) for (let x = 0; x < crop.width; x++) {
    const dx = (x - crop.width / 2) / rx, dy = (y - crop.height / 2) / ry
    if (dx * dx + dy * dy > 1) data[(y * crop.width + x) * info.channels + 3] = 0
  }
  return sharp(data, { raw: { width: crop.width, height: crop.height, channels: info.channels } })
    .resize(target.width, target.height).png().toBuffer()
}

async function buildOne(mood, look) {
  const name = assetName(mood.id, look.id)
  const lookFile = path.join(lookRoot, `${look.id}-front.png`)
  const target = await faceBounds(lookFile, 0.36)
  const face = await facePanel(path.join(emotionRoot, `${mood.assetName}.png`), target)
  const output = await sharp(lookFile)
    .composite([{ input: face, left: target.left, top: target.top }])
    .png({ compressionLevel: 9 }).toBuffer()
  await fs.promises.writeFile(path.join(winOutput, `${name}.png`), output)
  const imageSet = path.join(iosOutput, `${name}.imageset`)
  await fs.promises.mkdir(imageSet, { recursive: true })
  await fs.promises.writeFile(path.join(imageSet, `${name}.png`), output)
  await fs.promises.writeFile(path.join(imageSet, 'Contents.json'), JSON.stringify({
    images: [{ filename: `${name}.png`, idiom: 'universal', scale: '1x' }],
    info: { author: 'xcode', version: 1 }
  }, null, 2) + '\n')
}

async function main() {
  await fs.promises.mkdir(winOutput, { recursive: true })
  await fs.promises.mkdir(iosOutput, { recursive: true })
  for (const mood of MOODS) for (const look of LOOKS) await buildOne(mood, look)
  console.log(`Generated ${MOODS.length * LOOKS.length} complete Little Energy avatars.`)
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
