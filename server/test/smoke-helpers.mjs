export async function api(path, { method = 'GET', token, body } = {}, {
  base = 'http://localhost:3000',
  fetchImpl = fetch
} = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const res = await fetchImpl(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    })
    const data = await res.json().catch(() => ({}))
    return { status: res.status, data }
  } catch (error) {
    return { status: 0, data: { error: error instanceof Error ? error.message : String(error) } }
  }
}

export function waitForMessages(senderMessages, recipientMessages, predicate, {
  timeoutMs = 5000,
  intervalMs = 25
} = {}) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const receivedByBoth = () => senderMessages.some(predicate) && recipientMessages.some(predicate)
    const check = () => {
      if (receivedByBoth()) return resolve(true)
      if (Date.now() - startedAt >= timeoutMs) return resolve(false)
      setTimeout(check, intervalMs)
    }
    check()
  })
}

export async function withFixtureCleanup(run, cleanup) {
  try {
    return await run()
  } finally {
    await cleanup()
  }
}
