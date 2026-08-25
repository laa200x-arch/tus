import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const catalogPath = join(root, 'shared', 'little-energy', 'catalog.json')
const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
const catalogOnly = process.argv.includes('--catalog-only')

assert.ok(Array.isArray(catalog.moods), 'catalog.moods must be an array')
assert.equal(catalog.moods.length, 27, 'catalog must contain 27 moods')
assert.equal(new Set(catalog.moods.map((mood) => mood.id)).size, 27, 'catalog mood IDs must be unique')

for (const mood of catalog.moods) {
  for (const field of ['id', 'label', 'assetName', 'fallbackText']) {
    assert.equal(typeof mood[field], 'string', `mood ${mood.id || '<unknown>'} requires ${field}`)
  }
  assert.ok(typeof mood.legacyEmoji === 'string' || mood.legacyEmoji === null, `mood ${mood.id} requires legacyEmoji`)
  assert.equal(typeof mood.score, 'number', `mood ${mood.id} requires score`)
}

if (catalogOnly) {
  console.log(`Little Energy catalog valid: ${catalog.moods.length} moods.`)
} else {
  const required = [
    ...catalog.moods.flatMap((m) => [
      `win-app/assets/little-energy/emotions/${m.assetName}.png`,
      `TuS/Assets.xcassets/LittleEnergy/${m.assetName}.imageset/Contents.json`
    ]),
    'win-app/assets/little-energy/colleague/dark-colleague.png',
    'TuS/Assets.xcassets/LittleEnergy/dark-colleague.imageset/Contents.json'
  ]
  const missing = required.filter((relativePath) => !existsSync(join(root, relativePath)))

  if (missing.length) {
    console.error('Missing required Little Energy assets:')
    for (const relativePath of missing) console.error(`- ${relativePath}`)
    process.exitCode = 1
  } else {
    console.log(`Little Energy assets verified: ${required.length} files.`)
  }
}
