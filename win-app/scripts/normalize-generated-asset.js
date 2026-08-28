const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const sharp = require('sharp')
const { loadManifest } = require('./sync-ui-assets')

function parseArgs(argv) {
  const values = {}
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value == null) throw new Error('usage: --source PATH --name ASSET_NAME')
    values[key.slice(2)] = value
  }
  if (!values.source || !values.name) throw new Error('usage: --source PATH --name ASSET_NAME')
  return values
}

async function normalizeGeneratedAsset({ source, name, rootDir = path.resolve(__dirname, '..', '..') }) {
  const manifest = loadManifest(rootDir)
  const entry = [...manifest.icons, ...manifest.backgrounds].find((item) => item.name === name)
  if (!entry) throw new Error(`unknown manifest asset: ${name}`)
  if (entry.method !== 'imagegen') throw new Error(`${name} is not an imagegen asset`)
  if (!fs.existsSync(source)) throw new Error(`source does not exist: ${source}`)

  const sourceImage = sharp(source)
  const metadata = await sourceImage.metadata()
  if (entry.alpha && !metadata.hasAlpha) throw new Error(`${name} source has no alpha channel`)
  if (entry.alpha) {
    const stats = await sourceImage.ensureAlpha().stats()
    if (stats.channels[3].min !== 0) throw new Error(`${name} source has no transparent pixels`)
  }

  const output = path.join(rootDir, entry.canonicalPath)
  fs.mkdirSync(path.dirname(output), { recursive: true })
  await sourceImage
    .resize(entry.width, entry.height, {
      fit: entry.category === 'background' ? 'cover' : 'contain',
      position: 'centre',
      background: entry.alpha ? { r: 0, g: 0, b: 0, alpha: 0 } : { r: 250, g: 250, b: 255, alpha: 1 }
    })
    .png({ compressionLevel: 9 })
    .toFile(output)

  entry.generation = {
    tool: 'built-in-imagegen',
    promptVersion: manifest.promptVersion,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(output)).digest('hex')
  }
  const manifestPath = path.join(rootDir, 'assets', 'ui', 'asset-manifest.json')
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return output
}

if (require.main === module) {
  normalizeGeneratedAsset(parseArgs(process.argv))
    .then((output) => console.log(output))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}

module.exports = { normalizeGeneratedAsset }
