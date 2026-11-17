/**
 * Pure folds from a session surface snapshot into conversation messages.
 *
 * Mirrors the projection the built-in session-reference service uses: only
 * user-authored messages and assistant messages carry text worth quoting;
 * tool results, system rows and injected developer context are skipped.
 *
 * @module @jacksun1994/dsh-session-quote/lib/projection
 */

/**
 * Join the text blocks of one model content array.
 * @param {unknown} content - string or content-block array.
 * @returns {string} concatenated text, or an empty string.
 */
export function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  const parts = []
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string' && block.text !== '') {
      parts.push(block.text)
    }
  }
  return parts.join('\n')
}

/**
 * Fold surface events into ordered user/assistant messages.
 * @param {ReadonlyArray<{type?: string, seq?: number, time?: number, data?: any}>} events - current-surface events.
 * @returns {Array<{seq: number, id: string, role: 'user'|'assistant', at: number, text: string}>} messages in model-history order.
 */
export function foldConversation(events) {
  const messages = []
  for (const event of Array.isArray(events) ? events : []) {
    const type = event?.type
    if (type === 'user/message') {
      const source = event?.data?.source
      if (source === null || typeof source !== 'object' || source.kind !== 'user') continue
      const text = textOf(event?.data?.content)
      if (text.trim() === '') continue
      const id = typeof event?.data?.id === 'string' ? event.data.id : ''
      messages.push({ seq: Number(event.seq ?? 0), id, role: 'user', at: Number(event.time ?? 0), text })
    } else if (type === 'assistant/message') {
      const text = textOf(event?.data?.message?.content)
      if (text.trim() === '') continue
      const id = typeof event?.data?.message?.id === 'string' ? event.data.message.id : ''
      messages.push({ seq: Number(event.seq ?? 0), id, role: 'assistant', at: Number(event.time ?? 0), text })
    }
  }
  return messages
}

/**
 * One-line preview of a message body.
 * @param {unknown} text - message text.
 * @param {number} [limit] - maximum characters kept.
 * @returns {string} a single-line preview.
 */
export function preview(text, limit = 200) {
  const value = String(text ?? '').replace(/\s+/gu, ' ').trim()
  if (value.length <= limit) return value
  return `${value.slice(0, Math.max(0, limit - 1))}…`
}

/**
 * Cap a quoted body so one huge message cannot flood the prompt.
 * @param {unknown} text - message text.
 * @param {number} [limit] - maximum characters kept.
 * @returns {string} the text, with a visible truncation marker when capped.
 */
export function truncate(text, limit = 8000) {
  const value = String(text ?? '')
  if (value.length <= limit) return value
  return `${value.slice(0, limit)}\n…（已截断）`
}
