import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { MOODS, normalizeMood, normalizeOutfit, isLittleEnergyEmoji } from '../src/little-energy.js'

assert.equal(MOODS.length, 27)
assert.equal(new Set(MOODS.map((m) => m.id)).size, 27)

const legacyEmojiMappings = [
  ['😄', 'xnz_happy'],
  ['😐', 'xnz_calm'],
  ['😮‍💨', 'xnz_tired'],
  ['💀', 'xnz_sad'],
  ['😡', 'xnz_angry'],
  ['🙂', 'xnz_composed']
]
const catalogLegacyMappings = MOODS
  .filter((mood) => typeof mood.legacyEmoji === 'string')
  .map((mood) => [mood.legacyEmoji, mood.id])

assert.equal(catalogLegacyMappings.length, legacyEmojiMappings.length)
assert.equal(new Set(catalogLegacyMappings.map(([emoji]) => emoji)).size, catalogLegacyMappings.length)
assert.equal(new Set(catalogLegacyMappings.map(([, moodId]) => moodId)).size, catalogLegacyMappings.length)
assert.deepEqual(new Map(catalogLegacyMappings), new Map(legacyEmojiMappings))
for (const [emoji, moodId] of legacyEmojiMappings) {
  assert.equal(normalizeMood(emoji), moodId)
}
assert.equal(normalizeMood('xnz_angry'), 'xnz_angry')
assert.equal(normalizeMood('unknown'), 'xnz_happy')
assert.deepEqual(normalizeOutfit({ topId: 'bad' }), {
  topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers', accessoryIds: []
})
assert.equal(isLittleEnergyEmoji('xnz_grateful'), true)
assert.equal(isLittleEnergyEmoji('../bad.png'), false)

const verifier = spawnSync(process.execPath, ['../tools/verify-little-energy-assets.mjs', '--catalog-only'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8'
})
assert.equal(verifier.status, 0, verifier.stderr)

const tempDir = await mkdtemp(join(tmpdir(), 'jiyu-little-energy-'))
const databasePath = join(tempDir, 'little-energy.db')
const port = 32000 + (process.pid % 1000)
const baseUrl = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['src/index.js'], {
  cwd: new URL('..', import.meta.url),
  env: {
    ...process.env,
    PORT: String(port),
    SQLITE_PATH: databasePath,
    AUTO_SEED: 'true'
  },
  stdio: 'ignore'
})

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  return { status: response.status, data: await response.json() }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      if ((await api('/api/health')).status === 200) return
    } catch { /* server is still starting */ }
    await delay(50)
  }
  throw new Error('Test server did not start')
}

try {
  await waitForServer()
  const login = await api('/api/auth/login', {
    method: 'POST', body: { username: 'aqing', password: '123456' }
  })
  assert.equal(login.status, 200)
  const token = login.data.token
  assert.equal(typeof token, 'string')

  const update = await api('/api/me/profile', {
    method: 'PUT', token,
    body: { littleEnergyOutfit: {
      topId: 'top_hoodie', bottomId: 'bottom_jeans',
      shoesId: 'shoes_canvas', accessoryIds: ['accessory_headphones']
    } }
  })
  assert.equal(update.status, 200)
  assert.equal(update.data.user.littleEnergyOutfit.topId, 'top_hoodie')
  assert.deepEqual(update.data.user.littleEnergyOutfit, {
    topId: 'top_hoodie', bottomId: 'bottom_jeans',
    shoesId: 'shoes_canvas', accessoryIds: ['accessory_headphones']
  })

  const invalidOutfit = await api('/api/me/profile', {
    method: 'PUT', token,
    body: { littleEnergyOutfit: {
      topId: 'not-a-top', bottomId: 'not-a-bottom', shoesId: 'not-shoes',
      accessoryIds: ['not-an-accessory', 'accessory_headphones', 'accessory_headphones']
    } }
  })
  assert.equal(invalidOutfit.status, 200)
  assert.deepEqual(invalidOutfit.data.user.littleEnergyOutfit, {
    topId: 'top_tshirt', bottomId: 'bottom_slacks', shoesId: 'shoes_sneakers',
    accessoryIds: ['accessory_headphones']
  })

  const malformedOutfit = await api('/api/me/profile', {
    method: 'PUT', token, body: { littleEnergyOutfit: 'not-an-object' }
  })
  assert.equal(malformedOutfit.status, 400)

  const checkin = await api('/api/mood/checkin', {
    method: 'POST', token, body: { mood: 'xnz_grateful', stressSources: [], note: '' }
  })
  assert.equal(checkin.status, 200)
  assert.equal(checkin.data.mood, 'xnz_grateful')

  const invalidMood = await api('/api/mood/checkin', {
    method: 'POST', token, body: { mood: 'not-a-mood', stressSources: [], note: '' }
  })
  assert.equal(invalidMood.status, 400)

  const legacyCheckin = await api('/api/mood/checkin', {
    method: 'POST', token, body: { mood: '😐', stressSources: [], note: '' }
  })
  assert.equal(legacyCheckin.status, 200)
  assert.equal(legacyCheckin.data.mood, 'xnz_calm')

  const database = new DatabaseSync(databasePath)
  database.prepare('UPDATE mood_checkins SET mood = ? WHERE user_id = ?').run('😐', Number(login.data.user.id))
  database.close()

  const today = await api('/api/mood/today', { token })
  assert.equal(today.data.mood, 'xnz_calm')
  const trends = await api('/api/mood/trends?days=7', { token })
  assert.equal(trends.data.trend.at(-1).mood, 'xnz_calm')

  const tags = await api('/api/tags')
  assert.equal(tags.status, 200)
  assert.equal(tags.data.moods.length, 27)
  assert.deepEqual(tags.data.moods, MOODS)
} finally {
  server.kill()
  await once(server, 'exit')
  await rm(tempDir, { recursive: true, force: true })
}

console.log('Little Energy server: outfit persistence and stable 27-mood protocol passed.')
