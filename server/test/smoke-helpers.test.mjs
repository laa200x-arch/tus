import assert from 'node:assert/strict'
import test from 'node:test'

import * as helpers from './smoke-helpers.mjs'

const { api, waitForMessages } = helpers

test('api returns a diagnostic response when the transport rejects', async () => {
  const response = await api('/api/health', {}, {
    base: 'http://localhost:3000',
    fetchImpl: async () => { throw new TypeError('fetch failed') }
  })

  assert.equal(response.status, 0)
  assert.match(response.data.error, /fetch failed/)
})

test('waitForMessages accepts receipts that arrive after 300 ms but before its timeout', async () => {
  const senderMessages = []
  const recipientMessages = []
  const expected = 'delayed Socket receipt'
  const receipt = waitForMessages(
    senderMessages,
    recipientMessages,
    (message) => message?.text === expected,
    { timeoutMs: 750, intervalMs: 10 }
  )

  setTimeout(() => senderMessages.push({ text: expected }), 350)
  setTimeout(() => recipientMessages.push({ text: expected }), 400)

  assert.equal(await receipt, true)
})

test('withFixtureCleanup removes a fixture after smoke work rejects', async () => {
  let cleaned = false

  await assert.rejects(
    helpers.withFixtureCleanup(
      async () => { throw new Error('request interrupted') },
      async () => { cleaned = true }
    ),
    /request interrupted/
  )

  assert.equal(cleaned, true)
})
