import test from 'node:test'
import assert from 'node:assert/strict'
import { foldConversation, preview, textOf, truncate } from '../lib/projection.js'

test('textOf joins text blocks and ignores others', () => {
  assert.equal(textOf('plain'), 'plain')
  assert.equal(textOf([{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }]), 'a\nb')
  assert.equal(textOf(undefined), '')
  assert.equal(textOf([{ type: 'text', text: '' }]), '')
})

test('foldConversation keeps user and assistant text only', () => {
  const events = [
    { type: 'user/message', seq: 1, time: 10, data: { id: 'u1', source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] } },
    { type: 'assistant/message', seq: 2, time: 20, data: { message: { id: 'a1', content: [{ type: 'text', text: 'hi there' }] } } },
    { type: 'tool/result', seq: 3, time: 30, data: {} },
    { type: 'system/message', seq: 4, time: 40, data: {} },
    { type: 'user/message', seq: 5, time: 50, data: { source: { kind: 'developer' }, content: [{ type: 'text', text: 'injected' }] } },
    { type: 'user/message', seq: 6, time: 60, data: { source: { kind: 'user' }, content: [] } },
  ]
  assert.deepEqual(foldConversation(events), [
    { seq: 1, id: 'u1', role: 'user', at: 10, text: 'hello' },
    { seq: 2, id: 'a1', role: 'assistant', at: 20, text: 'hi there' },
  ])
})

test('foldConversation survives malformed rows', () => {
  assert.deepEqual(foldConversation([null, {}, { type: 'user/message' }, { type: 'assistant/message', data: {} }]), [])
  assert.deepEqual(foldConversation(undefined), [])
})

test('preview collapses whitespace and clamps length', () => {
  assert.equal(preview('a\n\n  b   c'), 'a b c')
  assert.equal(preview('x'.repeat(10), 5), 'xxxx…')
  assert.equal(preview(''), '')
})

test('truncate adds a marker only when it cuts', () => {
  assert.equal(truncate('short', 10), 'short')
  const cut = truncate('y'.repeat(12), 10)
  assert.ok(cut.startsWith('yyyyyyyyyy'))
  assert.ok(cut.includes('已截断'))
})
