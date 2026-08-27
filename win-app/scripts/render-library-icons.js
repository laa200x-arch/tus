const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const phosphor = require('@iconify-json/ph/icons.json')
const { loadManifest } = require('./sync-ui-assets')

async function renderLibraryIcons({ rootDir = path.resolve(__dirname, '..', '..') } = {}) {
  const manifest = loadManifest(rootDir)
  const entries = manifest.icons.filter((item) => item.method === 'library')
  const rendered = []

  for (const item of entries) {
    const icon = phosphor.icons[item.iconifyName]
    if (!icon) throw new Error(`Phosphor icon not found: ${item.iconifyName}`)
    const body = icon.body.replaceAll('currentColor', item.color)
    const svg = Buffer.from(`
      <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
        <g transform="translate(28 28) scale(0.78125)">${body}</g>
      </svg>
    `)
    const output = path.join(rootDir, item.canonicalPath)
    fs.mkdirSync(path.dirname(output), { recursive: true })
    await sharp(svg).png().toFile(output)
    rendered.push(output)
  }

  return rendered
}

if (require.main === module) {
  renderLibraryIcons()
    .then((files) => console.log(`Rendered ${files.length} library icons.`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}

module.exports = { renderLibraryIcons }

