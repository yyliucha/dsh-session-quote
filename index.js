/**
 * Host half of the session quote picker.
 *
 * The browser cannot read another session's conversation, so the Client asks
 * this half through the plugin's own volatile Configuration: it writes a
 * `request` ({ id, op, sessionId, … }) and polls for the matching `result`.
 * The host folds `sessionQuery.readSurface(sessionId)` — the same current-model
 * surface the built-in session-reference service consumes — into plain
 * user/assistant messages.
 *
 * @module @jacksun1994/dsh-session-quote
 */
import z from '@deepseek-ai/schemastery'
import { foldConversation, preview, truncate } from './lib/projection.js'

/** Loader-facing plugin name (also the bundle row id). */
export const name = 'session-quote'

/** Empty request; the Client fills it. */
const EMPTY_REQUEST = Object.freeze({ id: '', op: '', sessionId: '', messageId: '', seq: 0, limit: 80 })

/** Empty result. */
const EMPTY_RESULT = Object.freeze({ id: '', op: '', ok: false, messages: [], text: '', role: '', at: 0, error: '' })

/** Configuration: one request/result exchange, both volatile. */
export const Config = z.object({
  request: z.object({
    id: z.string().default(''),
    op: z.string().default(''),
    sessionId: z.string().default(''),
    messageId: z.string().default(''),
    seq: z.number().default(0),
    limit: z.number().default(80),
  }).default({ ...EMPTY_REQUEST }).volatile(),
  result: z.object({
    id: z.string().default(''),
    op: z.string().default(''),
    ok: z.boolean().default(false),
    messages: z.array(z.object({
      seq: z.number().default(0),
      id: z.string().default(''),
      role: z.string().default('user'),
      at: z.number().default(0),
      preview: z.string().default(''),
    })).default([]),
    text: z.string().default(''),
    role: z.string().default(''),
    at: z.number().default(0),
    error: z.string().default(''),
  }).default({ ...EMPTY_RESULT }).volatile(),
})

/**
 * Persist a patch into this plugin's own Configuration from Host code.
 * Runs outside the HMR transaction that owns `apply`, because the config editor
 * refuses nested transactions; a volatile-only change commits in place.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} patch - fields to merge into the entry config.
 * @returns {Promise<boolean>} whether the write was accepted.
 */
async function writeConfig(ctx, patch) {
  const entry = ctx.fiber?.entry
  const editor = ctx.get?.('configEditor')
  if (entry === undefined || editor === undefined) return false
  const run = () => editor.edit(entry, (current) => ({ ...current, ...patch }))
  const hmr = ctx.get?.('hmr')
  try {
    if (hmr?.executing?.exit) {
      let result
      hmr.executing.exit(() => { result = run() })
      await result
      return true
    }
    await run()
    return true
  } catch (error) {
    ctx.logger?.warn?.(`session-quote: saving configuration failed: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * Read a volatile object field defensively.
 * @param {{ get?: () => unknown }} field - volatile configuration field.
 * @returns {object | undefined} the value when it is a plain object.
 */
function readObject(field) {
  try {
    const value = field?.get?.()
    return value !== null && typeof value === 'object' ? value : undefined
  } catch {
    return undefined
  }
}

/**
 * Answer one Client request with a bounded conversation projection.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} config - parsed plugin config.
 * @returns {Promise<void>} resolves after the result was published.
 */
async function handleRequest(ctx, config) {
  const request = readObject(config.request)
  if (request === undefined) return
  const id = typeof request.id === 'string' ? request.id : ''
  const op = typeof request.op === 'string' ? request.op : ''
  if (id === '' || op === '') return
  const result = { ...EMPTY_RESULT, id, op, at: Date.now() }
  try {
    const sessionQuery = ctx.get?.('sessionQuery')
    if (sessionQuery === undefined || typeof sessionQuery.readSurface !== 'function') {
      throw new Error('session-query-unavailable')
    }
    const sessionId = typeof request.sessionId === 'string' ? request.sessionId : ''
    if (sessionId === '') throw new Error('missing-session')
    const snapshot = await sessionQuery.readSurface(sessionId)
    const conversation = foldConversation(snapshot?.events)
    if (op === 'messages') {
      const limit = Math.max(1, Math.min(200, Number(request.limit ?? 80) || 80))
      result.messages = conversation.slice(-limit).map((message) => ({
        seq: message.seq,
        id: message.id,
        role: message.role,
        at: message.at,
        preview: preview(message.text, 200),
      }))
      result.ok = true
    } else if (op === 'message') {
      const messageId = typeof request.messageId === 'string' ? request.messageId : ''
      const byId = messageId === '' ? undefined : conversation.find((message) => message.id === messageId)
      const target = byId ?? conversation.find((message) => message.seq === Number(request.seq ?? 0))
      if (target === undefined) throw new Error('message-not-found')
      result.text = truncate(target.text, 8000)
      result.role = target.role
      result.at = target.at
      result.ok = true
    } else {
      throw new Error('unknown-op')
    }
  } catch (error) {
    result.ok = false
    result.error = error instanceof Error ? (error.message || error.name) : String(error)
  }
  const saved = await writeConfig(ctx, { result })
  if (!saved) ctx.logger?.warn?.('session-quote: result could not be published (configuration is read-only in this profile)')
}

/**
 * Register the volatile-request listener.
 * @param {import('@deepseek-ai/cordis').Context} ctx - plugin context.
 * @param {object} config - parsed Configuration.
 */
export function apply(ctx, config) {
  ctx.on('loader/volatile-update', (paths) => {
    const kinds = (Array.isArray(paths) ? paths : []).map((path) => path?.[0])
    if (!kinds.includes('request')) return
    handleRequest(ctx, config).catch((error) => {
      ctx.logger?.warn?.(`session-quote: request failed: ${error instanceof Error ? error.message : String(error)}`)
    })
  })

  ctx.effect(() => {
    const timer = setTimeout(() => {
      // Drop a request left behind by a crash instead of answering a stale one.
      const pending = readObject(config.request)
      if (pending !== undefined && typeof pending.id === 'string' && pending.id !== '') {
        writeConfig(ctx, {
          request: { ...EMPTY_REQUEST },
          result: {
            ...EMPTY_RESULT,
            id: pending.id,
            op: String(pending.op ?? ''),
            error: 'request dropped: the plugin restarted before answering it',
            at: Date.now(),
          },
        }).catch(() => {})
      }
    }, 2000)
    timer?.unref?.()
    return () => clearTimeout(timer)
  }, 'session-quote: stale request guard')
}
