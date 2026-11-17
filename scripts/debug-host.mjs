import { apply } from '../index.js'
const listeners = new Map()
const writes = []
const warnings = []
const ctx = {
  on(e, f) { listeners.set(e, f) },
  effect(f) { const d = f(); if (typeof d === 'function') d() },
  get(name) {
    if (name === 'configEditor') return { edit: async (_e, fn) => { writes.push(fn({})) } }
    if (name === 'sessionQuery') return { readSurface: async () => ({ events: [ { type: 'user/message', seq: 1, time: 1, data: { source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] } } ] }) }
    return undefined
  },
  fiber: { entry: {} },
  logger: { warn(m) { warnings.push(String(m)) } },
}
const request = { id: 'q1', op: 'messages', sessionId: 's1', seq: 0, limit: 10 }
apply(ctx, { request: { get: () => request } })
listeners.get('loader/volatile-update')(['request'])
await new Promise(r => setTimeout(r, 200))
console.log('writes:', JSON.stringify(writes))
console.log('warnings:', JSON.stringify(warnings))
