/**
 * panel.js — Dopl Cowork Side Panel (Phase 2)
 *
 * Phase 1: Connection management, setup form, status display.
 * Phase 2: Full chat UI with streaming responses, markdown rendering,
 *          thinking blocks, typing indicator, abort, auto-scroll.
 */

'use strict'

const DEFAULT_PORT = 18134

// ── DOM refs ──────────────────────────────────────────────────────────────

const statusDot       = document.getElementById('status-dot')
const statusLabel     = document.getElementById('status-label')
const setupSection    = document.getElementById('setup-section')
const readySection    = document.getElementById('ready-section')
const chatArea        = document.getElementById('chat-area')
const chatMessages    = document.getElementById('chat-messages')
const typingIndicator = document.getElementById('typing-indicator')
const chatInputBar    = document.getElementById('chat-input-bar')
const chatTextarea    = document.getElementById('chat-textarea')
const sendBtn         = document.getElementById('send-btn')
const abortBtn        = document.getElementById('abort-btn')
const connectionKeyInput = document.getElementById('connection-key')
const saveBtn         = document.getElementById('save-btn')
const formStatus      = document.getElementById('form-status')
const relayValue      = document.getElementById('relay-value')
const hostValue       = document.getElementById('host-value')
const tabsValue       = document.getElementById('tabs-value')
const tabDot          = document.getElementById('tab-dot')
const tabLabel        = document.getElementById('tab-label')
const settingsBtn     = document.getElementById('settings-btn')
const panelMain       = document.getElementById('panel-main')

// ── Chat state ────────────────────────────────────────────────────────────

/** @type {Array<{role:'user'|'assistant', content:string, thinking:string, status:'streaming'|'done'|'error'}>} */
let messages = []
let isStreaming = false
let shouldAutoScroll = true

// Stable session key for this panel session
const CHAT_SESSION_KEY = `webchat-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`

// ── Markdown renderer ─────────────────────────────────────────────────────

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(text) {
  // Inline code (before bold/italic to avoid conflict)
  text = text.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
  // Bold
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  // Italic
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`)
  return text
}

/**
 * Lightweight markdown → HTML renderer for side panel.
 * Handles: code blocks, headings, lists, bold, italic, inline code, links.
 * @param {string} raw
 * @returns {string} HTML string
 */
function renderMarkdown(raw) {
  if (!raw) return ''

  // 1. Extract fenced code blocks and replace with placeholders
  const codeBlocks = []
  let s = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    const langClass = lang ? ` class="lang-${escapeHtml(lang)}"` : ''
    codeBlocks.push(`<pre><code${langClass}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
    return `\x00CB${idx}\x00`
  })

  // 2. Process line by line
  const lines = s.split('\n')
  const html = []
  let inUL = false
  let inOL = false

  function closeList() {
    if (inUL) { html.push('</ul>'); inUL = false }
    if (inOL) { html.push('</ol>'); inOL = false }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Code block placeholder — pass through
    if (/^\x00CB\d+\x00$/.test(line.trim())) {
      closeList()
      html.push(line.trim())
      continue
    }

    // Headings
    if (line.startsWith('#### ')) {
      closeList()
      html.push(`<h5>${renderInline(escapeHtml(line.slice(5)))}</h5>`)
      continue
    }
    if (line.startsWith('### ')) {
      closeList()
      html.push(`<h4>${renderInline(escapeHtml(line.slice(4)))}</h4>`)
      continue
    }
    if (line.startsWith('## ')) {
      closeList()
      html.push(`<h3>${renderInline(escapeHtml(line.slice(3)))}</h3>`)
      continue
    }
    if (line.startsWith('# ')) {
      closeList()
      html.push(`<h3>${renderInline(escapeHtml(line.slice(2)))}</h3>`)
      continue
    }

    // Unordered list
    const ulMatch = line.match(/^[-*+] (.*)$/)
    if (ulMatch) {
      if (inOL) { html.push('</ol>'); inOL = false }
      if (!inUL) { html.push('<ul>'); inUL = true }
      html.push(`<li>${renderInline(escapeHtml(ulMatch[1]))}</li>`)
      continue
    }

    // Ordered list
    const olMatch = line.match(/^\d+\. (.*)$/)
    if (olMatch) {
      if (inUL) { html.push('</ul>'); inUL = false }
      if (!inOL) { html.push('<ol>'); inOL = true }
      html.push(`<li>${renderInline(escapeHtml(olMatch[1]))}</li>`)
      continue
    }

    // Blank line
    if (line.trim() === '') {
      closeList()
      html.push('<br>')
      continue
    }

    // Regular line
    closeList()
    html.push(`<span class="md-line">${renderInline(escapeHtml(line))}</span><br>`)
  }

  closeList()

  s = html.join('\n')

  // 3. Restore code blocks
  s = s.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx, 10)])

  return s
}

// ── Message rendering ─────────────────────────────────────────────────────

function createMessageEl(msg, index) {
  const el = document.createElement('div')
  el.className = `chat-msg chat-msg--${msg.role}`
  el.dataset.index = String(index)

  if (msg.role === 'user') {
    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble msg-bubble--user'
    bubble.textContent = msg.content
    el.appendChild(bubble)
  } else {
    // Assistant message
    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble msg-bubble--assistant'

    // Thinking block (if any)
    if (msg.thinking) {
      const thinkingEl = document.createElement('details')
      thinkingEl.className = 'thinking-block'
      const summary = document.createElement('summary')
      summary.textContent = 'Thinking…'
      thinkingEl.appendChild(summary)
      const thinkBody = document.createElement('div')
      thinkBody.className = 'thinking-body'
      thinkBody.textContent = msg.thinking
      thinkingEl.appendChild(thinkBody)
      bubble.appendChild(thinkingEl)
    }

    // Content
    const contentEl = document.createElement('div')
    contentEl.className = 'msg-content'

    if (msg.status === 'streaming' && !msg.content) {
      // Show cursor blink while waiting for first token
      contentEl.innerHTML = '<span class="cursor-blink">▋</span>'
    } else if (msg.content) {
      contentEl.innerHTML = renderMarkdown(msg.content)
    }

    bubble.appendChild(contentEl)

    if (msg.status === 'error') {
      bubble.classList.add('msg-bubble--error')
    }

    el.appendChild(bubble)
  }

  return el
}

function updateMessageEl(el, msg) {
  if (msg.role === 'user') return // user messages don't change

  const bubble = el.querySelector('.msg-bubble--assistant')
  if (!bubble) return

  // Update or create thinking block
  let thinkingEl = bubble.querySelector('.thinking-block')
  if (msg.thinking) {
    if (!thinkingEl) {
      thinkingEl = document.createElement('details')
      thinkingEl.className = 'thinking-block'
      const summary = document.createElement('summary')
      summary.textContent = 'Thinking…'
      thinkingEl.appendChild(summary)
      const thinkBody = document.createElement('div')
      thinkBody.className = 'thinking-body'
      thinkingEl.appendChild(thinkBody)
      bubble.insertBefore(thinkingEl, bubble.firstChild)
    }
    const thinkBody = thinkingEl.querySelector('.thinking-body')
    if (thinkBody) thinkBody.textContent = msg.thinking
    // Update summary when done
    if (msg.status === 'done') {
      const summary = thinkingEl.querySelector('summary')
      if (summary) summary.textContent = 'Thought process'
    }
  }

  // Update content
  const contentEl = bubble.querySelector('.msg-content')
  if (contentEl) {
    if (msg.status === 'streaming' && !msg.content) {
      contentEl.innerHTML = '<span class="cursor-blink">▋</span>'
    } else if (msg.content) {
      contentEl.innerHTML = renderMarkdown(msg.content)
      // Add streaming cursor if still streaming
      if (msg.status === 'streaming') {
        contentEl.innerHTML += '<span class="cursor-blink">▋</span>'
      }
    }
  }

  if (msg.status === 'error') {
    bubble.classList.add('msg-bubble--error')
  }
}

function renderMessages() {
  // Sync DOM to messages array efficiently
  const existing = chatMessages.querySelectorAll('.chat-msg')

  // Update or create message elements
  for (let i = 0; i < messages.length; i++) {
    if (i < existing.length) {
      updateMessageEl(existing[i], messages[i])
    } else {
      const el = createMessageEl(messages[i], i)
      chatMessages.appendChild(el)
    }
  }

  // Remove extra elements (shouldn't happen but safety)
  while (chatMessages.children.length > messages.length) {
    // Skip typing indicator
    const last = chatMessages.lastElementChild
    if (last) chatMessages.removeChild(last)
  }

  maybeScrollBottom()
}

function appendUserMessage(text) {
  messages.push({ role: 'user', content: text, thinking: '', status: 'done' })
  const el = createMessageEl(messages[messages.length - 1], messages.length - 1)
  chatMessages.appendChild(el)
  maybeScrollBottom()
}

function appendAssistantPlaceholder() {
  messages.push({ role: 'assistant', content: '', thinking: '', status: 'streaming' })
  const el = createMessageEl(messages[messages.length - 1], messages.length - 1)
  chatMessages.appendChild(el)
  maybeScrollBottom()
}

function getLastAssistantEl() {
  const all = chatMessages.querySelectorAll('.chat-msg--assistant')
  return all.length ? all[all.length - 1] : null
}

// ── Auto-scroll ───────────────────────────────────────────────────────────

panelMain.addEventListener('scroll', () => {
  const { scrollTop, scrollHeight, clientHeight } = panelMain
  shouldAutoScroll = scrollTop + clientHeight >= scrollHeight - 60
})

function maybeScrollBottom() {
  if (shouldAutoScroll) {
    requestAnimationFrame(() => {
      panelMain.scrollTop = panelMain.scrollHeight
    })
  }
}

// ── Typing indicator ──────────────────────────────────────────────────────

function showTypingIndicator() {
  typingIndicator.classList.remove('hidden')
  maybeScrollBottom()
}

function hideTypingIndicator() {
  typingIndicator.classList.add('hidden')
}

// ── Chat send / abort ─────────────────────────────────────────────────────

function setStreamingState(streaming) {
  isStreaming = streaming
  sendBtn.disabled = streaming
  chatTextarea.disabled = streaming
  if (streaming) {
    abortBtn.classList.remove('hidden')
    sendBtn.classList.add('hidden')
  } else {
    abortBtn.classList.add('hidden')
    sendBtn.classList.remove('hidden')
    chatTextarea.disabled = false
    chatTextarea.focus()
  }
}

async function sendMessage() {
  const text = chatTextarea.value.trim()
  if (!text || isStreaming) return

  // Reset textarea
  chatTextarea.value = ''
  chatTextarea.style.height = 'auto'

  // Switch to chat view if not already there
  showChatSection()
  clearWelcome()

  // Add user message
  shouldAutoScroll = true
  appendUserMessage(text)
  appendAssistantPlaceholder()
  setStreamingState(true)

  // Send to background
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Send timeout')), 10000)
      chrome.runtime.sendMessage(
        { type: 'chat.send', text, sessionKey: CHAT_SESSION_KEY },
        (response) => {
          clearTimeout(timer)
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }
          if (response && !response.ok) {
            reject(new Error(response.error || 'Send failed'))
            return
          }
          resolve(response)
        }
      )
    })
  } catch (err) {
    handleChatError(err instanceof Error ? err.message : String(err))
  }
}

function abortChat() {
  chrome.runtime.sendMessage(
    { type: 'chat.abort', sessionKey: CHAT_SESSION_KEY },
    () => {}
  )
  setStreamingState(false)
  hideTypingIndicator()
  // Mark current streaming message as done
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'streaming') {
    last.status = 'done'
    if (!last.content) last.content = '*(aborted)*'
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
  }
}

function handleChatError(errMsg) {
  setStreamingState(false)
  hideTypingIndicator()
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'streaming') {
    last.status = 'error'
    last.content = errMsg || 'Something went wrong. Please try again.'
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
  } else {
    // Append error message
    messages.push({ role: 'assistant', content: errMsg, thinking: '', status: 'error' })
    const el = createMessageEl(messages[messages.length - 1], messages.length - 1)
    chatMessages.appendChild(el)
  }
  maybeScrollBottom()
}

// ── Incoming event handler ────────────────────────────────────────────────

function handleChatToken(delta) {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return
  last.content += delta
  last.status = 'streaming'
  const el = getLastAssistantEl()
  if (el) updateMessageEl(el, last)
  maybeScrollBottom()
}

function handleChatThinking(delta) {
  const last = messages[messages.length - 1]
  if (!last || last.role !== 'assistant') return
  last.thinking = (last.thinking || '') + delta
  const el = getLastAssistantEl()
  if (el) updateMessageEl(el, last)
}

function handleChatDone(fullText) {
  hideTypingIndicator()
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant') {
    last.status = 'done'
    if (fullText) last.content = fullText
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
  }
  setStreamingState(false)
  maybeScrollBottom()
}

// ── parseConnectionKey (mirrors options.js) ───────────────────────────────

function parseConnectionKey(key) {
  if (!key.startsWith('dopl_')) return null
  try {
    const b64 = key.slice(5).replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(pad))
    return {
      remoteHost: payload.h || '',
      port: payload.p || DEFAULT_PORT,
      token: payload.t || '',
    }
  } catch {
    return null
  }
}

// ── UI helpers ────────────────────────────────────────────────────────────

function setConnectionState(state) {
  statusDot.dataset.state = state
  const labels = {
    connected: 'Connected',
    connecting: 'Connecting…',
    disconnected: 'Disconnected',
  }
  statusLabel.textContent = labels[state] || 'Unknown'
}

function setFormStatus(kind, message) {
  formStatus.dataset.kind = kind || ''
  formStatus.textContent = message || ''
}

function showSetupSection() {
  setupSection.classList.remove('hidden')
  readySection.classList.add('hidden')
  chatArea.classList.add('hidden')
  chatInputBar.classList.add('hidden')
}

function showReadySection() {
  setupSection.classList.add('hidden')
  readySection.classList.remove('hidden')
  chatArea.classList.add('hidden')
  chatInputBar.classList.add('hidden')
}

function showChatSection() {
  setupSection.classList.add('hidden')
  readySection.classList.add('hidden')
  chatArea.classList.remove('hidden')
  chatInputBar.classList.remove('hidden')
  // Show welcome if no messages yet
  if (messages.length === 0 && chatMessages.children.length === 0) {
    renderWelcome()
  }
}

function renderWelcome() {
  const el = document.createElement('div')
  el.className = 'chat-welcome'
  el.innerHTML = `
    <div class="welcome-icon">✦</div>
    <p class="welcome-text">How can I help you today?</p>
  `
  chatMessages.appendChild(el)
}

function clearWelcome() {
  const w = chatMessages.querySelector('.chat-welcome')
  if (w) w.remove()
}

function updateTabStatus(tabs) {
  if (!tabs || tabs.length === 0) {
    tabDot.classList.remove('attached')
    tabLabel.textContent = 'No tab attached'
    tabsValue.textContent = 'None'
    tabsValue.className = 'info-value warn'
    return
  }
  tabDot.classList.add('attached')
  const count = tabs.length
  tabLabel.textContent = count === 1
    ? (tabs[0].title || tabs[0].url || 'Tab attached')
    : `${count} tabs attached`
  tabsValue.textContent = String(count)
  tabsValue.className = 'info-value ok'
}

function updateRelayInfo(state) {
  const { remoteHost, port, connected } = state
  if (remoteHost) {
    relayValue.textContent = connected ? 'Connected' : 'Connecting…'
    relayValue.className = 'info-value' + (connected ? ' ok' : ' warn')
    hostValue.textContent = remoteHost
  } else if (port) {
    relayValue.textContent = connected ? 'Connected (local)' : 'Connecting…'
    relayValue.className = 'info-value' + (connected ? ' ok' : ' warn')
    hostValue.textContent = `127.0.0.1:${port}`
  } else {
    relayValue.textContent = '—'
    relayValue.className = 'info-value'
    hostValue.textContent = '—'
  }
}

// ── Background communication ──────────────────────────────────────────────

async function getPanelState() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timeout')), 3000)
    chrome.runtime.sendMessage({ type: 'panel.getState' }, (response) => {
      clearTimeout(timer)
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      resolve(response || {})
    })
  })
}

// ── Main init ─────────────────────────────────────────────────────────────

async function init() {
  let stored
  try {
    stored = await chrome.storage.local.get(['connectionKey', 'gatewayToken', 'remoteHost', 'relayPort'])
  } catch (err) {
    console.warn('panel: storage read failed', err)
    stored = {}
  }

  const connectionKey = String(stored.connectionKey || '').trim()
  const hasToken = Boolean(stored.gatewayToken || stored.remoteHost)

  if (connectionKey) {
    connectionKeyInput.value = connectionKey
  }

  if (!hasToken) {
    showSetupSection()
    setConnectionState('disconnected')
    return
  }

  setConnectionState('connecting')

  try {
    const state = await getPanelState()
    applyState(state)
  } catch (err) {
    console.warn('panel: could not get state from background', err)
    const port = stored.relayPort || DEFAULT_PORT
    const remoteHost = String(stored.remoteHost || '').trim()
    showReadySection()
    updateRelayInfo({ remoteHost, port, connected: false })
    setConnectionState('disconnected')
    updateTabStatus([])
  }
}

function applyState(state) {
  const connected = Boolean(state.connected)
  const tabs = Array.isArray(state.tabs) ? state.tabs : []
  const remoteHost = String(state.remoteHost || '').trim()
  const port = state.port || DEFAULT_PORT

  if (state.hasConfig === false) {
    showSetupSection()
    setConnectionState('disconnected')
    return
  }

  if (connected) {
    showChatSection()
  } else {
    showReadySection()
  }

  setConnectionState(connected ? 'connected' : 'connecting')
  updateRelayInfo({ remoteHost, port, connected })
  updateTabStatus(tabs)
}

// ── Listen for messages from background.js ────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return

  switch (msg.type) {
    case 'panel.stateChanged':
      applyState(msg)
      break

    case 'chat.token':
      clearWelcome()
      handleChatToken(String(msg.delta || ''))
      break

    case 'chat.thinking':
      handleChatThinking(String(msg.delta || ''))
      break

    case 'chat.done':
      handleChatDone(msg.fullText || '')
      break

    case 'chat.lifecycle':
      if (msg.phase === 'start') {
        showTypingIndicator()
      } else if (msg.phase === 'end') {
        hideTypingIndicator()
        // Final cleanup if no chat.done arrived
        const last = messages[messages.length - 1]
        if (last && last.role === 'assistant' && last.status === 'streaming') {
          last.status = 'done'
          const el = getLastAssistantEl()
          if (el) updateMessageEl(el, last)
          setStreamingState(false)
        }
      }
      break

    case 'chat.error':
      handleChatError(msg.message || 'An error occurred.')
      break

    default:
      break
  }
})

// ── Save connection key ───────────────────────────────────────────────────

async function saveConnectionKey() {
  const rawKey = String(connectionKeyInput.value || '').trim()

  if (!rawKey) {
    setFormStatus('error', 'Please enter a connection key.')
    return
  }

  const parsed = parseConnectionKey(rawKey)
  if (!parsed) {
    setFormStatus('error', 'Invalid key. It should start with dopl_ and come from your Dopl Settings page.')
    return
  }

  setFormStatus('', 'Saving…')

  try {
    await chrome.storage.local.set({
      connectionKey: rawKey,
      relayPort: parsed.port,
      gatewayToken: parsed.token,
      remoteHost: parsed.remoteHost,
    })
  } catch (err) {
    setFormStatus('error', 'Failed to save. Please try again.')
    console.error('panel: storage write failed', err)
    return
  }

  setFormStatus('ok', 'Saved! Connecting…')

  showReadySection()
  setConnectionState('connecting')
  updateRelayInfo({ remoteHost: parsed.remoteHost, port: parsed.port, connected: false })
  updateTabStatus([])

  setTimeout(async () => {
    try {
      const state = await getPanelState()
      applyState(state)
    } catch {
      // ignore — state broadcasts will update us
    }
  }, 1500)
}

// ── Input bar handlers ────────────────────────────────────────────────────

sendBtn.addEventListener('click', () => void sendMessage())

abortBtn.addEventListener('click', () => abortChat())

chatTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void sendMessage()
  }
})

// Auto-resize textarea
chatTextarea.addEventListener('input', () => {
  chatTextarea.style.height = 'auto'
  chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px'
})

// ── Button handlers ───────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => void saveConnectionKey())

connectionKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void saveConnectionKey()
})

settingsBtn.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage()
})

// ── Boot ──────────────────────────────────────────────────────────────────

void init()
