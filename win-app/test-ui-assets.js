const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')
const manifestPath = path.join(projectRoot, 'assets', 'ui', 'asset-manifest.json')

const expectedIcons = [
  'ui_brand_tus',
  'ui_nav_home', 'ui_nav_plaza', 'ui_nav_publish', 'ui_nav_messages', 'ui_nav_profile',
  'ui_action_search', 'ui_action_back', 'ui_action_more', 'ui_action_chevron',
  'ui_action_like', 'ui_action_comment', 'ui_action_share', 'ui_action_send', 'ui_action_add',
  'ui_feature_checkin', 'ui_feature_plaza', 'ui_feature_my_complaints', 'ui_feature_colleagues',
  'ui_publish_complaint', 'ui_publish_dynamic', 'ui_publish_mood', 'ui_publish_colleague',
  'ui_message_interaction', 'ui_message_system', 'ui_message_ai', 'ui_message_update',
  'ui_profile_complaints', 'ui_profile_favorites', 'ui_profile_posts', 'ui_profile_history',
  'ui_tool_report', 'ui_tool_ai', 'ui_tool_stress', 'ui_tool_relationship',
  'ui_row_colleague', 'ui_row_company', 'ui_badge_level', 'ui_avatar_anonymous'
]

const expectedBackgrounds = ['ui_bg_app_soft', 'ui_decor_home_hero']

function readManifest() {
  assert.ok(fs.existsSync(manifestPath), `missing manifest: ${manifestPath}`)
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
}

function validateEntry(entry) {
  for (const key of ['name', 'category', 'method', 'width', 'height', 'alpha', 'screens', 'iosAsset', 'windowsPath', 'consumers']) {
    assert.ok(Object.prototype.hasOwnProperty.call(entry, key), `${entry.name || '<unnamed>'} missing ${key}`)
  }
  assert.ok(Array.isArray(entry.screens) && entry.screens.length > 0, `${entry.name} has no screens`)
  assert.ok(Array.isArray(entry.consumers) && entry.consumers.length > 0, `${entry.name} has no consumers`)
  assert.ok(entry.iosAsset, `${entry.name} has no iosAsset`)
  assert.ok(entry.windowsPath, `${entry.name} has no windowsPath`)
}

function validateSchema(manifest) {
  assert.equal(manifest.schemaVersion, 1)
  assert.ok(manifest.reference?.path)
  assert.match(manifest.reference.sha256, /^[a-f0-9]{64}$/)
  const referencePath = path.join(projectRoot, manifest.reference.path)
  assert.ok(fs.existsSync(referencePath), `missing design reference: ${referencePath}`)
  assert.equal(
    crypto.createHash('sha256').update(fs.readFileSync(referencePath)).digest('hex'),
    manifest.reference.sha256,
    'design reference hash changed'
  )
  assert.equal(manifest.icons.length, 39)
  assert.equal(manifest.backgrounds.length, 2)

  const iconNames = manifest.icons.map((item) => item.name)
  const backgroundNames = manifest.backgrounds.map((item) => item.name)
  assert.equal(new Set(iconNames).size, 39)
  assert.equal(new Set(backgroundNames).size, 2)
  assert.deepEqual([...iconNames].sort(), [...expectedIcons].sort())
  assert.deepEqual([...backgroundNames].sort(), [...expectedBackgrounds].sort())

  for (const item of [...manifest.icons, ...manifest.backgrounds]) validateEntry(item)
  for (const item of manifest.icons) {
    assert.deepEqual([item.width, item.height, item.alpha], [256, 256, true], `${item.name} icon contract`)
    assert.ok(['library', 'imagegen'].includes(item.method), `${item.name} has invalid method`)
    if (item.method === 'library') assert.ok(item.iconifyName, `${item.name} missing iconifyName`)
    if (item.method === 'imagegen') assert.ok(item.prompt, `${item.name} missing prompt`)
  }
  assert.deepEqual(
    manifest.backgrounds.map((item) => [item.name, item.width, item.height, item.alpha]),
    [
      ['ui_bg_app_soft', 1024, 1536, false],
      ['ui_decor_home_hero', 1024, 1024, true]
    ]
  )
}

async function validateCanonicalFiles(manifest, filter) {
  const sharp = require('sharp')
  const entries = [...manifest.icons, ...manifest.backgrounds].filter(filter)
  for (const item of entries) {
    const filePath = path.join(projectRoot, item.canonicalPath)
    assert.ok(fs.existsSync(filePath), `missing canonical asset: ${item.name}`)
    const image = sharp(filePath)
    const metadata = await image.metadata()
    assert.equal(metadata.format, 'png', `${item.name} is not PNG`)
    assert.deepEqual([metadata.width, metadata.height], [item.width, item.height], `${item.name} dimensions`)
    if (item.alpha) assert.ok(metadata.hasAlpha, `${item.name} has no alpha channel`)
    if (item.alpha) {
      const stats = await image.ensureAlpha().stats()
      assert.ok(stats.channels[3].min === 0, `${item.name} has no transparent pixel`)
      assert.ok(stats.channels[3].max > 0, `${item.name} has no visible pixel`)
    }
    if (item.method === 'library') {
      const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
      let minX = info.width
      let minY = info.height
      let maxX = -1
      let maxY = -1
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          if (data[(y * info.width + x) * info.channels + 3] === 0) continue
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
        }
      }
      assert.ok(minX >= 28 && minY >= 28 && maxX <= 227 && maxY <= 227, `${item.name} exceeds 28px safety margin`)
    }
  }
  return entries.length
}

async function main() {
  const manifest = readManifest()
  validateSchema(manifest)

  if (process.argv.includes('--schema-only')) {
    console.log('PASS | 39 icons / 2 backgrounds / 0 duplicate names')
    return
  }

  const methodIndex = process.argv.indexOf('--method')
  const method = methodIndex >= 0 ? process.argv[methodIndex + 1] : null
  const groupIndex = process.argv.indexOf('--group')
  const group = groupIndex >= 0 ? process.argv[groupIndex + 1] : null
  const count = await validateCanonicalFiles(manifest, (item) => {
    if (method && item.method !== method) return false
    if (group && item.group !== group) return false
    return true
  })
  console.log(`PASS | ${count} canonical UI assets valid`)
}

main().catch((error) => {
  console.error(`FAIL | ${error.message}`)
  process.exitCode = 1
})
