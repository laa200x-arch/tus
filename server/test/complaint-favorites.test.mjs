import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const workspaceDirectory = path.resolve(serverDirectory, '..')
const runDirectory = path.join(workspaceDirectory, '.codex-run', `complaint-favorites-${process.pid}`)
const port = 3180 + Math.floor(Math.random() * 200)
const base = `http://127.0.0.1:${port}`

mkdirSync(runDirectory, { recursive: true })

function request(pathname, { method = 'GET', token, body } = {}) {
  return fetch(`${base}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(async (response) => ({ status: response.status, data: await response.json() }))
}

async function waitForServer() {
  const deadline = Date.now() + 10_000
  let latestError
  while (Date.now() < deadline) {
    try {
      const response = await request('/api/health')
      if (response.status === 200 && response.data?.ok === true) return
    } catch (error) {
      latestError = error
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Test server did not start: ${latestError?.message || 'health check timed out'}`)
}

const server = spawn(process.execPath, ['src/index.js'], {
  cwd: serverDirectory,
  env: {
    ...process.env,
    PORT: String(port),
    SQLITE_PATH: path.join(runDirectory, 'favorites.db'),
    AUTO_SEED: 'true'
  },
  stdio: ['ignore', 'pipe', 'pipe']
})

let output = ''
server.stdout.on('data', (chunk) => { output += chunk })
server.stderr.on('data', (chunk) => { output += chunk })

try {
  await waitForServer()
  const login = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'aqing', password: '123456' }
  })
  assert.equal(login.status, 200)
  assert.equal(typeof login.data.token, 'string')
  const token = login.data.token

  const created = await request('/api/complaints', {
    method: 'POST',
    token,
    body: { content: `收藏接口测试 ${Date.now()}`, category: 'leader', sentiment: 'xnz_happy' }
  })
  assert.equal(created.status, 201)
  const complaintId = created.data.complaint?.id
  assert.equal(typeof complaintId, 'string')

  const first = await request(`/api/complaints/${complaintId}/favorite`, { method: 'POST', token })
  assert.equal(first.status, 200)
  assert.deepEqual(first.data, { favorited: true, favoriteCount: 1 })

  const detail = await request(`/api/complaints/${complaintId}`, { token })
  assert.equal(detail.status, 200)
  assert.equal(detail.data.complaint?.id, complaintId)
  assert.equal(detail.data.complaint?.favorited, true)
  assert.equal(detail.data.complaint?.favoriteCount, 1)
  assert.equal(detail.data.complaint?.viewCount, 1, 'first authenticated detail view counts one viewer')

  const repeatedDetail = await request(`/api/complaints/${complaintId}`, { token })
  assert.equal(repeatedDetail.status, 200)
  assert.equal(repeatedDetail.data.complaint?.viewCount, 1, 'the same viewer is counted once')

  const secondLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { username: 'mili', password: '123456' }
  })
  assert.equal(secondLogin.status, 200)
  const secondDetail = await request(`/api/complaints/${complaintId}`, { token: secondLogin.data.token })
  assert.equal(secondDetail.status, 200)
  assert.equal(secondDetail.data.complaint?.viewCount, 2, 'a different authenticated viewer increments the people count')

  const saved = await request('/api/complaints/favorites', { token })
  assert.equal(saved.status, 200)
  assert.equal(saved.data.complaints?.[0]?.id, complaintId)

  const filtered = await request('/api/complaints/feed?topic=%E6%94%B6%E8%97%8F%E6%8E%A5%E5%8F%A3%E6%B5%8B%E8%AF%95', { token })
  assert.equal(filtered.status, 200)
  assert.equal(filtered.data.complaints?.some((complaint) => complaint.id === complaintId), true)

  const second = await request(`/api/complaints/${complaintId}/favorite`, { method: 'POST', token })
  assert.deepEqual(second.data, { favorited: false, favoriteCount: 0 })
} finally {
  server.kill('SIGTERM')
  await new Promise((resolve) => server.once('exit', resolve))
  rmSync(runDirectory, { recursive: true, force: true })
}

console.log('Complaint favorites: persistent toggle, detail, saved list and topic filtering passed.')
