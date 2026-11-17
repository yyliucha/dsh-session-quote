window.__ModuleLoader__.load({
  id: '@jacksun1994/dsh-session-quote',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    const NS = 'sessionQuote'
    const SETTINGS_NS = 'session-quote'

    //#region dictionaries
    const zh = {
      'entry.label': '引用',
      'title': '引用历史消息',
      'back': '返回会话',
      'close': '关闭',
      'loading': '读取中…',
      'noSessions': '当前工作区还没有其他会话',
      'noMessages': '这个会话没有可引用的消息',
      'error': '读取失败',
      'error.noSettings': '设置服务不可用',
      'error.noEntry': '插件配置未加载，请重启后重试',
      'search.placeholder': '搜索会话',
      'role.user': '我',
      'role.assistant': '助手',
      'current': '当前会话',
      'pick': '引用这条',
      'quoting': '引用中…',
      'quoted': '已引用',
      'action.quote': '引用这条消息',
    }
    const en = {
      'entry.label': 'Quote',
      'title': 'Quote an earlier message',
      'back': 'Back to sessions',
      'close': 'Close',
      'loading': 'Reading…',
      'noSessions': 'No other session in this workspace yet',
      'noMessages': 'This session has no quotable message',
      'error': 'Could not read',
      'error.noSettings': 'The settings service is unavailable',
      'error.noEntry': 'The plugin configuration is not loaded; restart and retry',
      'search.placeholder': 'Search sessions',
      'role.user': 'Me',
      'role.assistant': 'Assistant',
      'current': 'current',
      'pick': 'Quote this message',
      'quoting': 'Quoting…',
      'quoted': 'Quoted',
      'action.quote': 'Quote this message',
    }
    //#endregion

    //#region shared helpers
    function unwrap(result) {
      if (result && typeof result === 'object' && 'ok' in result) {
        if (result.ok === true) return result.value
        const error = result.error
        const message = error && typeof error === 'object' && typeof error.message === 'string' ? error.message : ''
        const code = error && typeof error === 'object' && typeof error.code === 'string' ? error.code : ''
        const thrown = new Error(message || code || 'remote failure')
        thrown.code = code
        throw thrown
      }
      return result
    }

    function remoteSettings(ctx) {
      try { return ctx.remote.settings } catch { return undefined }
    }

    /** Subscribe to the Client session list the sidebar already maintains. */
    function useSessionsSnapshot(sessions) {
      const [snapshot, setSnapshot] = React.useState(() => (sessions && sessions.list ? sessions.list.getSnapshot() : undefined))
      React.useEffect(() => {
        if (!sessions || !sessions.list) return undefined
        const store = sessions.list
        const read = () => setSnapshot(store.getSnapshot())
        read()
        return store.subscribe(read)
      }, [sessions])
      return snapshot
    }

    function sleep(ms) {
      return new Promise((done) => setTimeout(done, ms))
    }

    function requestId() {
      return `q-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    }

    function formatTime(at) {
      const value = Number(at ?? 0)
      if (!Number.isFinite(value) || value <= 0) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return ''
      return date.toLocaleString()
    }

    function relativeTime(at) {
      const value = Number(at ?? 0)
      if (!Number.isFinite(value) || value <= 0) return ''
      const delta = Date.now() - value
      const minute = 60 * 1000
      if (delta < minute) return '刚刚'
      if (delta < 60 * minute) return `${Math.floor(delta / minute)} 分钟前`
      if (delta < 24 * 60 * minute) return `${Math.floor(delta / (60 * minute))} 小时前`
      if (delta < 30 * 24 * 60 * minute) return `${Math.floor(delta / (24 * 60 * minute))} 天前`
      return new Date(value).toLocaleDateString()
    }

    /**
     * Ask the host half for one conversation projection through the plugin's
     * volatile Configuration: write the request, then poll for its result.
     */
    async function askHost(ctx, payload, timeoutMs = 20000) {
      const settings = remoteSettings(ctx)
      if (settings === undefined) throw new Error('error.noSettings')
      const id = requestId()
      const request = {
        id,
        op: payload.op,
        sessionId: payload.sessionId ?? '',
        messageId: payload.messageId ?? '',
        seq: payload.seq ?? 0,
        limit: payload.limit ?? 80,
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const view = unwrap(await settings.describe())
        const entry = view?.namespaces?.find((item) => item.ns === SETTINGS_NS)
        if (entry === undefined) throw new Error('error.noEntry')
        try {
          unwrap(await settings.update(SETTINGS_NS, { request }, entry.revision))
          break
        } catch (error) {
          const message = error instanceof Error ? error.message : ''
          if (!/changed since it was read/i.test(message) || attempt === 1) throw error
        }
      }
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        await sleep(250)
        const view = unwrap(await settings.describe())
        const entry = view?.namespaces?.find((item) => item.ns === SETTINGS_NS)
        const result = entry?.value?.result
        if (result !== null && typeof result === 'object' && result.id === id) {
          if (result.ok !== true) throw new Error(result.error || 'error')
          return result
        }
      }
      throw new Error('timeout')
    }
    //#endregion

    //#region official style tokens
    const RADIUS_XS = 'var(--dsw-radius-xs)'
    const RADIUS_SM = 'var(--dsw-radius-sm)'
    const RADIUS_MD = 'var(--dsw-radius-md)'
    const RADIUS_LG = 'var(--dsw-radius-lg)'
    const MENU_SURFACE = {
      border: 0,
      borderRadius: RADIUS_LG,
      background: 'var(--dsw-menu-surface-fill)',
      backdropFilter: 'var(--dsw-menu-backdrop-filter)',
      boxShadow: 'var(--dsw-elevation-prominent)',
      '--dsw-elevation-stroke-color': 'var(--dsw-alias-border-l1)',
      '--dsh-scrollbar-thumb': 'var(--dsw-alias-scrollbar-bg-l2)',
      '--dsh-scrollbar-thumb-hover': 'var(--dsw-alias-scrollbar-hover-l2)',
      color: 'var(--dsw-alias-label-primary)',
    }
    //#endregion

    function QuoteIcon(props) {
      const size = props.size ?? 14
      return h('svg', {
        width: size, height: size, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
        style: { display: 'block', flexShrink: 0, color: props.color ?? 'currentColor' },
      },
      h('path', {
        d: 'M4.2 5.2c-.9.7-1.4 1.7-1.4 2.9 0 .7.4 1.2 1 1.2s1-.5 1-1.1c0-.6-.4-1-.9-1 .2-.4.5-.8.9-1.1zM9.3 5.2c-.9.7-1.4 1.7-1.4 2.9 0 .7.4 1.2 1 1.2s1-.5 1-1.1c0-.6-.4-1-.9-1 .2-.4.5-.8.9-1.1z',
        fill: 'currentColor',
      }),
      h('path', {
        d: 'M3.2 10.6v-5c0-1.2 1-2.2 2.2-2.2h5.2c1.2 0 2.2 1 2.2 2.2v2.2c0 1.2-1 2.2-2.2 2.2H6.2l-2 1.6z',
        stroke: 'currentColor', strokeWidth: 1.2, opacity: 0.55,
      }))
    }

    //#region store
    const EMPTY = Object.freeze({
      open: false,
      step: 'sessions',
      targetSessionId: undefined,
      messages: [],
      loading: false,
      error: undefined,
      quotingSeq: undefined,
    })

    function createStore() {
      const snapshots = new Map()
      const listeners = new Set()
      const read = (key) => snapshots.get(key) ?? EMPTY
      const notify = () => { for (const listener of listeners) listener() }
      const set = (key, patch) => {
        snapshots.set(key, { ...read(key), ...patch })
        notify()
      }
      const subscribe = (listener) => {
        listeners.add(listener)
        return () => listeners.delete(listener)
      }
      const open = (key) => set(key, { ...EMPTY, open: true })
      const close = (key) => set(key, { ...EMPTY })
      const back = (key) => set(key, { step: 'sessions', targetSessionId: undefined, messages: [], error: undefined, loading: false })
      return { read, set, subscribe, open, close, back }
    }

    function useSnapshot(store, key) {
      const [snapshot, setSnapshot] = React.useState(() => store.read(key))
      React.useEffect(() => {
        const update = () => setSnapshot(store.read(key))
        update()
        return store.subscribe(update)
      }, [store, key])
      return snapshot
    }
    //#endregion

    /**
     * Composer entry: a compact chip that opens a two-step picker
     * (sessions of this workspace → one message) and inserts the chosen
     * message as the composer's own atomic quote.
     */
    function createComposerButton(ctx, store) {
      return function SessionQuoteButton(props) {
        const t = props.t
        const sessionId = props.sessionId
        const key = sessionId === undefined ? '' : String(sessionId)
        const snapshot = useSnapshot(store, key)
        const sessions = useSessionsSnapshot(ctx.sessions)
        const [hover, setHover] = React.useState(false)
        const buttonRef = React.useRef(null)
        const panelRef = React.useRef(null)

        const current = sessions && sessions.byId ? sessions.byId[key] : undefined
        const cwd = current && typeof current.cwd === 'string' ? current.cwd : undefined

        const sessionRows = React.useMemo(() => {
          if (!sessions || !sessions.byId) return []
          const ids = Array.isArray(sessions.ids) ? sessions.ids : Object.keys(sessions.byId)
          return ids
            .map((id) => sessions.byId[id])
            .filter((row) => row !== undefined && row.origin !== 'subagent' && row.displayTitle !== undefined)
            .filter((row) => (cwd === undefined ? true : row.cwd === cwd))
            .sort((left, right) => (right.updatedAt ?? 0) - (left.updatedAt ?? 0))
            .slice(0, 60)
            .map((row) => ({ id: String(row.id), title: String(row.displayTitle ?? row.id), updatedAt: Number(row.updatedAt ?? 0) }))
        }, [sessions, cwd])

        const openPanel = () => {
          store.open(key)
        }

        React.useEffect(() => {
          if (!snapshot.open) return undefined
          try {
            const el = panelRef.current
            if (el === null) return undefined
            const native = typeof el.showPopover === 'function'
            if (native) {
              el.setAttribute('popover', 'manual')
              try { el.showPopover() } catch { /* keep hidden */ }
            }
            el.style.visibility = 'visible'
            const rect = buttonRef.current && buttonRef.current.getBoundingClientRect ? buttonRef.current.getBoundingClientRect() : undefined
            if (rect) {
              const maxWidth = 460
              const preferred = 420
              el.style.left = `${Math.max(8, Math.min(rect.left, Math.max(8, window.innerWidth - maxWidth)))}px`
              el.style.width = `${Math.min(preferred, Math.max(280, window.innerWidth - 16))}px`
              el.style.maxHeight = `${Math.max(220, rect.top - 24)}px`
              if (native) {
                el.style.bottom = `${Math.max(8, window.innerHeight - rect.top + 8)}px`
                el.style.top = 'auto'
                el.style.right = 'auto'
              } else {
                el.style.bottom = 'calc(100% + 8px)'
              }
            }
            const onPointerDown = (event) => {
              const target = event.target
              if (target && target.closest && target.closest('[data-sq-panel]')) return
              if (buttonRef.current && buttonRef.current.contains && buttonRef.current.contains(target)) return
              store.close(key)
            }
            const onKeyDown = (event) => { if (event.key === 'Escape') store.close(key) }
            document.addEventListener('mousedown', onPointerDown, true)
            document.addEventListener('keydown', onKeyDown, true)
            return () => {
              document.removeEventListener('mousedown', onPointerDown, true)
              document.removeEventListener('keydown', onKeyDown, true)
              if (typeof el.hidePopover === 'function') {
                try { el.hidePopover() } catch { /* already closed */ }
              }
            }
          } catch (error) {
            try { console.error('[session-quote] panel effect failed:', error) } catch { /* ignore */ }
            return undefined
          }
        }, [snapshot.open, key, store])

        const chooseSession = async (target) => {
          store.set(key, { step: 'messages', targetSessionId: target.id, loading: true, error: undefined, messages: [] })
          try {
            const result = await askHost(ctx, { op: 'messages', sessionId: target.id, limit: 80 })
            store.set(key, { loading: false, messages: Array.isArray(result.messages) ? result.messages : [] })
          } catch (error) {
            store.set(key, { loading: false, error: String(error && error.message ? error.message : error) })
          }
        }

        const quoteMessage = async (target, message) => {
          store.set(key, { quotingSeq: message.seq, error: undefined })
          try {
            const result = await askHost(ctx, {
              op: 'message',
              sessionId: target.id,
              messageId: message.id ?? '',
              seq: message.seq,
            })
            const text = typeof result.text === 'string' ? result.text : ''
            if (text.trim() === '') throw new Error('empty-message')
            const roleLabel = t(message.role === 'assistant' ? 'role.assistant' : 'role.user')
            const summary = {
              label: `${roleLabel}：`,
              title: `会话：${target.title}`,
              detail: `${formatTime(message.at)} · ${roleLabel}`,
              body: text,
            }
            const inserted = insertQuote(props, sessionId, text, summary)
            if (!inserted) throw new Error('insert-refused')
            store.close(key)
          } catch (error) {
            store.set(key, { quotingSeq: undefined, error: String(error && error.message ? error.message : error) })
          }
        }

        const button = h('button', {
          ref: buttonRef,
          type: 'button',
          title: t('entry.label'),
          'aria-haspopup': 'dialog',
          'aria-expanded': snapshot.open,
          onClick: () => { if (snapshot.open) store.close(key); else openPanel() },
          onMouseEnter: () => setHover(true),
          onMouseLeave: () => setHover(false),
          style: {
            display: 'inline-flex', alignItems: 'center', gap: 4, height: 28,
            padding: '0 4px 0 8px', border: 'none', borderRadius: RADIUS_SM,
            background: snapshot.open || hover ? 'var(--dsw-alias-interactive-bg-hover)' : 'transparent',
            color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 13, lineHeight: '20px',
            fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          }
        },
        h(QuoteIcon, { size: 14 }),
        h('span', null, t('entry.label')))

        if (!snapshot.open) {
          return h('span', { style: { position: 'relative', display: 'inline-flex' } }, button)
        }

        const target = snapshot.targetSessionId === undefined
          ? undefined
          : sessionRows.find((row) => row.id === snapshot.targetSessionId)

        const header = h('div', {
          style: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px 4px', fontSize: 13, lineHeight: '20px' }
        },
        snapshot.step === 'messages'
          ? h('button', {
            type: 'button',
            onClick: () => store.back(key),
            style: { height: 24, padding: '0 6px', border: 0, borderRadius: RADIUS_SM, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 12, cursor: 'pointer' }
          }, '‹ ' + t('back'))
          : h(QuoteIcon, { size: 14, color: 'var(--dsw-alias-label-secondary)' }),
        h('span', { style: { color: 'var(--dsw-alias-label-primary)', fontWeight: 500 } },
          snapshot.step === 'messages' ? (target === undefined ? t('title') : target.title) : t('title')),
        h('span', { style: { flex: 1 } }),
        h('button', {
          type: 'button',
          onClick: () => store.close(key),
          style: { height: 24, padding: '0 6px', border: 0, borderRadius: RADIUS_SM, background: 'transparent', color: 'var(--dsw-alias-label-secondary)', font: 'inherit', fontSize: 12, cursor: 'pointer' }
        }, t('close')))

        let body
        if (snapshot.error !== undefined) {
          body = h('div', { style: { padding: '8px', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-state-error-primary)' } },
            t('error') + ': ' + snapshot.error)
        } else if (snapshot.loading) {
          body = h('div', { style: { padding: '8px', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } }, t('loading'))
        } else if (snapshot.step === 'sessions') {
          body = sessionRows.length === 0
            ? h('div', { style: { padding: '8px', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } }, t('noSessions'))
            : h('div', { style: { overflowY: 'auto', padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
              sessionRows.map((row) => h('button', {
                key: row.id,
                type: 'button',
                onClick: () => { void chooseSession(row) },
                style: {
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '6px 8px', border: 0, borderRadius: RADIUS_MD, background: 'transparent',
                  color: 'var(--dsw-alias-label-primary)', font: 'inherit', fontSize: 13, lineHeight: '20px', cursor: 'pointer',
                }
              },
              h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, row.title),
              row.id === key ? h('span', { style: { flexShrink: 0, fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' } }, t('current')) : null,
              h('span', { style: { flexShrink: 0, fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' } }, relativeTime(row.updatedAt)))))
        } else {
          body = snapshot.messages.length === 0
            ? h('div', { style: { padding: '8px', fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-tertiary)' } }, t('noMessages'))
            : h('div', { style: { overflowY: 'auto', padding: 0, display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 } },
              snapshot.messages.map((message) => {
                const quoting = snapshot.quotingSeq === message.seq
                const roleLabel = t(message.role === 'assistant' ? 'role.assistant' : 'role.user')
                return h('button', {
                  key: String(message.seq),
                  type: 'button',
                  disabled: snapshot.quotingSeq !== undefined,
                  onClick: () => { if (target !== undefined) void quoteMessage(target, message) },
                  style: {
                    display: 'flex', flexDirection: 'column', gap: 2, width: '100%', textAlign: 'left',
                    padding: '6px 8px', border: 0, borderRadius: RADIUS_MD, background: 'transparent',
                    color: 'var(--dsw-alias-label-primary)', font: 'inherit', cursor: quoting ? 'default' : 'pointer',
                    opacity: snapshot.quotingSeq !== undefined && !quoting ? 0.5 : 1,
                  }
                },
                h('span', { style: { display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 11, lineHeight: '16px', color: 'var(--dsw-alias-label-tertiary)' } },
                  h('span', { style: { fontWeight: 500, color: 'var(--dsw-alias-label-secondary)' } }, roleLabel),
                  h('span', null, formatTime(message.at)),
                  quoting ? h('span', null, '· ' + t('quoting')) : null),
                h('span', { style: { fontSize: 12, lineHeight: '18px', color: 'var(--dsw-alias-label-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, message.preview))
              }))
        }

        const panel = h('div', {
          ref: panelRef,
          'data-sq-panel': '1',
          role: 'dialog',
          'aria-label': t('title'),
          style: {
            ...MENU_SURFACE,
            position: 'fixed', left: 8, bottom: 96, margin: 0, padding: 4,
            width: 420, maxHeight: 360,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
            visibility: 'hidden', zIndex: 90,
          }
        }, header, body)

        return h('span', { style: { position: 'relative', display: 'inline-flex' } }, button, panel)
      }
    }

    /** Insert the host-provided text as the composer's own atomic quote. */
    function insertQuote(props, sessionId, text, summary) {
      try {
        if (props.inputActions !== undefined && typeof props.inputActions.insertQuote === 'function') {
          if (props.inputActions.insertQuote(text, summary)) return true
        }
      } catch (error) {
        try { console.error('[session-quote] input action failed:', error) } catch { /* ignore */ }
      }
      return false
    }

    /**
     * Per-message entry on the assistant action strip: quote this reply into
     * the composer without selecting its text first.
     */
    function createAssistantAction(ctx) {
      return function AssistantQuoteAction(props) {
        const t = props.t
        const sessionId = props.sessionId
        const messageId = props.messageId
        const [busy, setBusy] = React.useState(false)
        const [done, setDone] = React.useState(false)
        const onClick = async () => {
          if (busy || sessionId === undefined || messageId === undefined) return
          setBusy(true)
          try {
            const result = await askHost(ctx, { op: 'message', sessionId, messageId })
            const text = typeof result.text === 'string' ? result.text : ''
            if (text.trim() === '') throw new Error('empty-message')
            const roleLabel = t(result.role === 'user' ? 'role.user' : 'role.assistant')
            const summary = {
              label: `${roleLabel}：`,
              title: t('title'),
              detail: formatTime(result.at),
              body: text,
            }
            if (!insertQuote(props, sessionId, text, summary)) throw new Error('insert-refused')
            setDone(true)
            setTimeout(() => setDone(false), 1500)
          } catch (error) {
            try { console.error('[session-quote] message quote failed:', error) } catch { /* ignore */ }
          } finally {
            setBusy(false)
          }
        }
        return h('button', {
          type: 'button',
          title: t('action.quote'),
          'aria-label': t('action.quote'),
          disabled: busy,
          onClick,
          style: {
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            height: 24, padding: '0 6px', border: 0, borderRadius: RADIUS_SM,
            background: 'transparent',
            color: done ? 'var(--dsw-alias-state-success-primary)' : 'var(--dsw-alias-label-tertiary)',
            cursor: busy ? 'default' : 'pointer',
            opacity: busy ? 0.5 : 1,
          }
        }, h(QuoteIcon, { size: 14 }))
      }
    }

    return {
      inject: ['slots', 'locale', 'sessions', 'remote', 'remote.settings'],
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'session-quote: dictionaries')
        const t = ctx.locale.bind(NS)
        const store = createStore()
        const Button = createComposerButton(ctx, store)
        ctx.effect(() => ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'session-quote',
          order: 3,
          label: () => t('entry.label'),
        }, (props) => h(Button, { ...props, t }))), 'session-quote: composer button')

        const AssistantAction = createAssistantAction(ctx)
        ctx.effect(() => ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
          name: 'conversation.chat.assistant-actions',
          id: 'session-quote',
          order: 20,
          locale: NS,
        }, (props) => h(AssistantAction, { ...props, t }))), 'session-quote: assistant action')
      },
    }
  },
})
