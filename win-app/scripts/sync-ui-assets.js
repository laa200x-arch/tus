const fs = require('fs')
const path = require('path')

function loadManifest(rootDir) {
  const manifestPath = path.join(rootDir, 'assets', 'ui', 'asset-manifest.json')
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

function writeJSON(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`)
}

function ensureAssetGroup(groupPath) {
  writeJSON(path.join(groupPath, 'Contents.json'), {
    info: { author: 'xcode', version: 1 },
    properties: { 'provides-namespace': true }
  })
}

function iosContents(filename, template) {
  const image = {
    filename,
    idiom: 'universal',
    scale: '1x'
  }
  if (template) image['template-rendering-intent'] = 'template'
  return {
    images: [image],
    info: { author: 'xcode', version: 1 },
    properties: { 'preserves-vector-representation': false }
  }
}

async function syncUIAssets({ rootDir = path.resolve(__dirname, '..', '..'), allowMissing = false } = {}) {
  const manifest = loadManifest(rootDir)
  const entries = [...manifest.icons, ...manifest.backgrounds]
  const iosRoot = path.join(rootDir, 'TuS', 'Assets.xcassets', 'UI')
  const iosIcons = path.join(iosRoot, 'Icons')
  const iosBackgrounds = path.join(iosRoot, 'Backgrounds')
  const windowsRoot = path.join(rootDir, 'win-app', 'assets', 'ui')

  ensureAssetGroup(iosRoot)
  ensureAssetGroup(iosIcons)
  ensureAssetGroup(iosBackgrounds)
  const syncedNames = []

  for (const item of entries) {
    const source = path.join(rootDir, item.canonicalPath)
    if (!fs.existsSync(source)) {
      if (allowMissing) continue
      throw new Error(`missing canonical asset: ${item.name}`)
    }

    const group = item.category === 'background' || item.category === 'decoration' ? iosBackgrounds : iosIcons
    const imageSet = path.join(group, `${item.iosAsset}.imageset`)
    const filename = `${item.iosAsset}.png`
    fs.mkdirSync(imageSet, { recursive: true })
    fs.copyFileSync(source, path.join(imageSet, filename))
    writeJSON(path.join(imageSet, 'Contents.json'), iosContents(filename, item.method === 'library'))

    const windowsTarget = path.join(windowsRoot, item.windowsPath)
    fs.mkdirSync(path.dirname(windowsTarget), { recursive: true })
    fs.copyFileSync(source, windowsTarget)
    syncedNames.push(item.name)
  }

  return syncedNames
}

if (require.main === module) {
  syncUIAssets({ allowMissing: process.argv.includes('--allow-missing') })
    .then((names) => console.log(`Synced ${names.length} UI assets to iOS and Windows.`))
    .catch((error) => {
      console.error(error.message)
      process.exitCode = 1
    })
}

module.exports = { loadManifest, syncUIAssets }
