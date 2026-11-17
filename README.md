# dsh-session-quote

A [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that quotes **one message from an earlier session** into the composer as an inline quote — the same compact quote chip the composer already renders for text selected in the current conversation.

## What it does

- Adds a compact **引用 / Quote** control to the composer tool row, beside the skills entry.
- Clicking it opens a two-step picker:
  1. the sessions of the current workspace (same working directory), newest first;
  2. that session's recent user and assistant messages, with role, time and a preview.
- Picking a message inserts it as the composer's own atomic quote node (label + body + remove button). It is sent as an ordinary Markdown blockquote, so the model reads it as a quote attached to your question — and knows which message the reply is about.
- Nothing is stored: the quote is plain draft text, and the picker reads sessions through the built-in `sessionQuery` service.

## Install

```sh
dsh plugin --profile <profile> add @jacksun1994/dsh-session-quote
```

or install this directory as a local bundle. Refresh the page once.

## How it works

The browser cannot read another session's conversation, so the Client asks the Host half through the plugin's own volatile Configuration: it writes a `request` (`{ id, op: 'messages' | 'message', sessionId, seq }`) and polls for the matching `result`. The Host folds `sessionQuery.readSurface(sessionId)` into plain user/assistant messages — the same current-surface projection the built-in `session-reference` service consumes.

Limits:

- Only sessions whose working directory matches the current session are listed.
- Message previews are truncated to 200 characters; a quoted body is capped at 8000 characters with a visible truncation marker.
- Reading a session replays its log (`readSurface` validates the whole log), so very large histories take a moment.
- The quote is text in the draft: editing or deleting it is ordinary text editing, and the original session is never modified.

## Development

```sh
npm install
npm test          # node --test: projection folds, host request handling
```

## License

MIT
