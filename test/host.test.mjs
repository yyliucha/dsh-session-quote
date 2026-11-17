import test from 'node:test'
import assert from 'node:assert/strict'
import { apply } from '../index.js'

/** Minimal Cordis context capturing the volatile listener and config writes. */
function harness(options = {}) {
  const listeners = new Map()
  const writes = []
  const config = { request: { get: () => options.request } }
  const ctx = {
    on(event, listener) { listeners.set(event, listener) },
    effect(fn) { const dispose = fn(); if (typeof dispose === 'function') dispose() },
    get(name) {
      if (name === 'configEditor') return { edit: async (_entry, fn) => { writes.push(fn({})) } }
      if (name === 'sessionQuery') return options.sessionQuery
      return undefined
    },
    fiber: { entry: {} },
    logger: { warn() {} },
  }
  apply(ctx, config)
  return { listeners, writes }
}

/** Wait until the async request handler published its result. */
async function settle(writes) {
  for (let index = 0; index < 100; index += 1) {
    if (writes.length > 0 && writes.at(-1).result !== undefined) return writes.at(-1).result
    await new Promise((done) => setTimeout(done, 5))
  }
  throw new Error('no result was written')
}

const events = [
  { type: 'user/message', seq: 1, time: 1000, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: 'how do we deploy?' }] } },
  { type: 'assistant/message', seq: 2, time: 2000, data: { message: { id: 'a1', content: [{ type: 'text', text: 'with docker compose up' }] } } },
]

test('answers a messages request with previews', async () => {
  const { listeners, writes } = harness({
    request: { id: 'q1', op: 'messages', sessionId: 's1', seq: 0, limit: 10 },
    sessionQuery: { readSurface: async () => ({ events }) },
  })
  listeners.get('loader/volatile-update')([['request']])
  const result = await settle(writes)
  assert.equal(result.ok, true)
  assert.deepEqual(result.messages, [
    { seq: 1, id: 'u1', role: 'user', at: 1000, preview: 'how do we deploy?' },
    { seq: 2, id: 'a1', role: 'assistant', at: 2000, preview: 'with docker compose up' },
  ])
})

test('answers a message request with the full text', async () => {
  const { listeners, writes } = harness({
    request: { id: 'q2', op: 'message', sessionId: 's1', seq: 2 },
    sessionQuery: { readSurface: async () => ({ events }) },
  })
  listeners.get('loader/volatile-update')([['request']])
  const result = await settle(writes)
  assert.equal(result.ok, true)
  assert.equal(result.text, 'with docker compose up')
})

test('reports a missing session query service', async () => {
  const { listeners, writes } = harness({
    request: { id: 'q3', op: 'messages', sessionId: 's1' },
    sessionQuery: undefined,
  })
  listeners.get('loader/volatile-update')([['request']])
  const result = await settle(writes)
  assert.equal(result.ok, false)
  assert.equal(result.error, 'session-query-unavailable')
})

test('ignores unrelated volatile fields', async () => {
  const { listeners, writes } = harness({
    request: { id: 'q4', op: 'messages', sessionId: 's1' },
    sessionQuery: { readSurface: async () => ({ events }) },
  })
  listeners.get('loader/volatile-update')([['result']])
  await new Promise((done) => setTimeout(done, 30))
  assert.equal(writes.length, 0)
})
test('finds a message by durable message id', async () => {
  const { listeners, writes } = harness({
    request: { id: 'q5', op: 'message', sessionId: 's1', messageId: 'a1', seq: 0 },
    sessionQuery: { readSurface: async () => ({ events }) },
  })
  listeners.get('loader/volatile-update')([['request']])
  const result = await settle(writes)
  assert.equal(result.ok, true)
  assert.equal(result.text, 'with docker compose up')
  assert.equal(result.role, 'assistant')
  assert.equal(result.at, 2000)
})
