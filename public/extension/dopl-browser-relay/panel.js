/**
 * panel.js — Dopl Side Panel
 *
 * Per-tab chat: each tab gets its own chat session + auto-attaches.
 * Switching tabs switches the chat context. No manual attach/detach.
 */

'use strict'

const DEFAULT_PORT = 18134

// ── DOM refs ──────────────────────────────────────────────────────────────

const statusDot       = document.getElementById('status-dot')
const statusLabel     = document.getElementById('status-label')
const setupSection    = document.getElementById('setup-section')
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
const panelMain       = document.getElementById('panel-main')

// ── Per-tab chat state ────────────────────────────────────────────────────

/**
 * Each tab gets its own chat state, keyed by tabId.
 * @type {Map<number, {messages: Array, isStreaming: boolean, sessionKey: string}>}
 */
const tabChats = new Map()

/** Currently active tab ID */
let activeTabId = null
let shouldAutoScroll = true

function getOrCreateTabChat(tabId) {
  if (!tabChats.has(tabId)) {
    tabChats.set(tabId, {
      messages: [],
      isStreaming: false,
      sessionKey: `ext-tab-${tabId}-${Date.now()}`,
    })
  }
  return tabChats.get(tabId)
}

/** Persist chat state for a tab to chrome.storage.session */
function persistTabChat(tabId) {
  const chat = tabChats.get(tabId)
  if (!chat) return
  // Only persist non-streaming messages (strip streaming state)
  const toSave = chat.messages
    .filter(m => m.status !== 'streaming')
    .map(m => ({ role: m.role, content: m.content, thinking: m.thinking || '', status: m.status }))
  chrome.storage.session.set({ [`chat-${tabId}`]: { messages: toSave, sessionKey: chat.sessionKey } }).catch(() => {})
}

/** Restore chat state for a tab from chrome.storage.session */
async function restoreTabChat(tabId) {
  try {
    const result = await chrome.storage.session.get(`chat-${tabId}`)
    const saved = result[`chat-${tabId}`]
    if (saved && Array.isArray(saved.messages) && saved.messages.length > 0) {
      tabChats.set(tabId, {
        messages: saved.messages,
        isStreaming: false,
        sessionKey: saved.sessionKey || `ext-tab-${tabId}-${Date.now()}`,
      })
      return true
    }
  } catch { /* ignore */ }
  return false
}

/** Clear persisted chat when tab is closed */
function clearTabChat(tabId) {
  tabChats.delete(tabId)
  chrome.storage.session.remove(`chat-${tabId}`).catch(() => {})
}

function getActiveChat() {
  if (!activeTabId) return null
  return getOrCreateTabChat(activeTabId)
}

// ── Markdown + Card rendering ─────────────────────────────────────────────

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderInline(text) {
  text = text.replace(/`([^`\n]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`)
  text = text.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  text = text.replace(/__([^_\n]+)__/g, '<strong>$1</strong>')
  text = text.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  text = text.replace(/_([^_\n]+)_/g, '<em>$1</em>')
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer">${label}</a>`)
  return text
}

function renderCardTags(text) {
  text = text.replace(/\[\[integration:([a-z][a-z0-9-]*)\]\]/g, (_, provider) => {
    const name = provider.charAt(0).toUpperCase() + provider.slice(1)
    return `<div class="card-tag card-tag--integration"><span class="card-tag-icon">🔗</span><div><strong>Connect ${escapeHtml(name)}</strong><div class="card-tag-hint">Open <a href="https://usedopl.com/settings" target="_blank">Settings</a> to connect</div></div></div>`
  })
  text = text.replace(/\[\[integration-status:(\w+):(connected|error)(?::([^\]]+))?\]\]/g, (_, provider, status, account) => {
    const name = provider.charAt(0).toUpperCase() + provider.slice(1)
    const icon = status === 'connected' ? '✅' : '❌'
    const acct = account ? ` — ${escapeHtml(account)}` : ''
    return `<div class="card-tag card-tag--status"><span class="card-tag-icon">${icon}</span><strong>${escapeHtml(name)}</strong> ${status}${acct}</div>`
  })
  text = text.replace(/\[\[task:([^:]+):([^:]+)(?::([^\]]+))?\]\]/g, (_, name, status, details) => {
    const icons = { running: '⏳', complete: '✅', failed: '❌' }
    const icon = icons[status] || '⚙️'
    const det = details ? `<div class="card-tag-hint">${escapeHtml(details)}</div>` : ''
    return `<div class="card-tag card-tag--task"><span class="card-tag-icon">${icon}</span><div><strong>${escapeHtml(name)}</strong>${det}</div></div>`
  })
  text = text.replace(/\[\[browser:(https?:\/\/[^\]:\s]+)(?::([^\]]+))?\]\]/g, (_, url, message) => {
    const msg = message ? escapeHtml(message) : 'Opening page…'
    return `<div class="card-tag card-tag--browser"><span class="card-tag-icon">🌐</span><div><a href="${escapeHtml(url)}" target="_blank">${msg}</a></div></div>`
  })
  text = text.replace(/\[\[email:(\{[^\]]*\})\]\]/g, (_, json) => {
    try {
      const email = JSON.parse(json)
      const to = Array.isArray(email.to) ? email.to.join(', ') : (email.to || '')
      return `<div class="card-tag card-tag--email"><span class="card-tag-icon">✉️</span><div><strong>${escapeHtml(email.subject || 'Email')}</strong><div class="card-tag-hint">To: ${escapeHtml(to)}</div></div></div>`
    } catch { return '' }
  })
  text = text.replace(/\[\[scan:(google|slack|notion)\]\]/g, (_, p) => {
    return `<div class="card-tag card-tag--task"><span class="card-tag-icon">🔍</span><strong>Scanning ${escapeHtml(p)}…</strong></div>`
  })
  text = text.replace(/\[\[scan-result:(\{[^\]]*\})\]\]/g, (_, json) => {
    try { const r = JSON.parse(json); return `<div class="card-tag card-tag--status"><span class="card-tag-icon">✅</span><div><strong>Scan complete</strong><div class="card-tag-hint">${r.totalMemories || 0} memories · ${r.durationSeconds || 0}s</div></div></div>` } catch { return '' }
  })
  text = text.replace(/\[\[skill:suggest:([^,\]]+)(?:,([^\]]+))?\]\]/g, (_, id, reason) => {
    const r = reason ? `<div class="card-tag-hint">${escapeHtml(reason)}</div>` : ''
    return `<div class="card-tag card-tag--task"><span class="card-tag-icon">📦</span><div><strong>Skill: ${escapeHtml(id)}</strong>${r}</div></div>`
  })
  text = text.replace(/\[\[welcome:([^,\]]+),([^\]]+)\]\]/g, (_, u, a) => {
    return `<div class="card-tag card-tag--welcome"><span class="card-tag-icon">👋</span><strong>Welcome, ${escapeHtml(u.trim())}!</strong> I'm ${escapeHtml(a.trim())}.</div>`
  })
  text = text.replace(/\[\[browser-relay:download\]\]/g, () =>
    `<div class="card-tag card-tag--task"><span class="card-tag-icon">🧩</span><strong>Browser Relay</strong> <span class="card-tag-hint">Already installed!</span></div>`)
  text = text.replace(/\[\[companion:download\]\]/g, () =>
    `<div class="card-tag card-tag--task"><span class="card-tag-icon">💻</span><div><strong>Dopl Companion</strong><div class="card-tag-hint"><a href="https://usedopl.com/settings" target="_blank">Download</a></div></div></div>`)
  text = text.replace(/\[\[workflow:suggest:([\s\S]*?)\]\]/g, (_, payload) => {
    try { const s = JSON.parse(payload); if (!Array.isArray(s)) return ''; const items = s.map(x => `<li><strong>${escapeHtml(x.title||x.id||'')}</strong> — ${escapeHtml(x.description||'')}</li>`).join(''); return `<div class="card-tag card-tag--workflow"><span class="card-tag-icon">⚡</span><div><strong>Suggested workflows</strong><ul>${items}</ul></div></div>` } catch { return '' }
  })
  text = text.replace(/\[\[context:summary:(\{.*?\})\]\]/g, (_, json) => {
    try { const d = JSON.parse(json); const items = (d.insights||[]).map(i => `<li>${i.icon||'•'} ${escapeHtml(i.text||'')}</li>`).join(''); return `<div class="card-tag card-tag--status"><span class="card-tag-icon">📊</span><div><strong>Summary</strong><ul>${items}</ul></div></div>` } catch { return '' }
  })
  text = text.replace(/\[\[workflow:(\{[\s\S]*?\})\]\]/g, (_, json) => {
    try { const wf = JSON.parse(json); if (!wf.name) return ''; return `<div class="card-tag card-tag--workflow"><span class="card-tag-icon">⚡</span><strong>${escapeHtml(wf.name)}</strong></div>` } catch { return '' }
  })
  text = text.replace(/\[\[integrations:resolve:([^\]]+)\]\]/g, (_, s) =>
    `<div class="card-tag card-tag--integration"><span class="card-tag-icon">🔗</span><strong>Checking:</strong> ${escapeHtml(s)}</div>`)
  text = text.replace(/\[\[subagent:progress:(\{.*?\})\]\]/g, (_, json) => {
    try { const d = JSON.parse(json); const a = Array.isArray(d.agents)?d.agents:(d?[d]:[]); const items = a.map(x => { const ic = {scanning:'⏳',complete:'✅',error:'❌'}; return `<li>${ic[x.status]||'⚙️'} ${escapeHtml(x.name||'')} — ${escapeHtml(x.source||'')}</li>` }).join(''); return `<div class="card-tag card-tag--task"><span class="card-tag-icon">🤖</span><div><strong>Agent progress</strong><ul>${items}</ul></div></div>` } catch { return '' }
  })
  text = text.replace(/\[Attached files:([^\]]+)\]/g, (_, f) => {
    const items = f.split(',').map(x => `<li>📎 ${escapeHtml(x.trim())}</li>`).join('')
    return `<div class="card-tag card-tag--task"><span class="card-tag-icon">📎</span><div><strong>Attached files</strong><ul>${items}</ul></div></div>`
  })
  text = text.replace(/\[\[action:[^\]]+\]\]/g, '')
  text = text.replace(/\[\[[^\]]*\]\]/g, '')
  return text
}

function renderMarkdown(raw) {
  if (!raw) return ''

  raw = renderCardTags(raw)
  const cardBlocks = []
  raw = raw.replace(/<div class="card-tag[\s\S]*?<\/div>\s*<\/div>/g, (match) => {
    const idx = cardBlocks.length; cardBlocks.push(match); return `\x00CT${idx}\x00`
  })
  raw = raw.replace(/<div class="card-tag[^"]*">[^]*?<\/div>/g, (match) => {
    if (match.includes('\x00CT')) return match
    const idx = cardBlocks.length; cardBlocks.push(match); return `\x00CT${idx}\x00`
  })

  const codeBlocks = []
  let s = raw.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length
    const langClass = lang ? ` class="lang-${escapeHtml(lang)}"` : ''
    codeBlocks.push(`<pre><code${langClass}>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`)
    return `\x00CB${idx}\x00`
  })

  const lines = s.split('\n')
  const html = []
  let inUL = false, inOL = false

  function closeList() {
    if (inUL) { html.push('</ul>'); inUL = false }
    if (inOL) { html.push('</ol>'); inOL = false }
  }

  for (const line of lines) {
    if (/^\x00CB\d+\x00$/.test(line.trim()) || /^\x00CT\d+\x00$/.test(line.trim())) {
      closeList(); html.push(line.trim()); continue
    }
    if (line.startsWith('#### ')) { closeList(); html.push(`<h5>${renderInline(escapeHtml(line.slice(5)))}</h5>`); continue }
    if (line.startsWith('### ')) { closeList(); html.push(`<h4>${renderInline(escapeHtml(line.slice(4)))}</h4>`); continue }
    if (line.startsWith('## ')) { closeList(); html.push(`<h3>${renderInline(escapeHtml(line.slice(3)))}</h3>`); continue }
    if (line.startsWith('# ')) { closeList(); html.push(`<h3>${renderInline(escapeHtml(line.slice(2)))}</h3>`); continue }
    const ulMatch = line.match(/^[-*+] (.*)$/)
    if (ulMatch) { if (inOL) { html.push('</ol>'); inOL = false }; if (!inUL) { html.push('<ul>'); inUL = true }; html.push(`<li>${renderInline(escapeHtml(ulMatch[1]))}</li>`); continue }
    const olMatch = line.match(/^\d+\. (.*)$/)
    if (olMatch) { if (inUL) { html.push('</ul>'); inUL = false }; if (!inOL) { html.push('<ol>'); inOL = true }; html.push(`<li>${renderInline(escapeHtml(olMatch[1]))}</li>`); continue }
    if (line.trim() === '') { closeList(); html.push('<br>'); continue }
    closeList()
    html.push(`<span class="md-line">${renderInline(escapeHtml(line))}</span><br>`)
  }
  closeList()

  s = html.join('\n')
  s = s.replace(/\x00CB(\d+)\x00/g, (_, idx) => codeBlocks[parseInt(idx, 10)])
  s = s.replace(/\x00CT(\d+)\x00/g, (_, idx) => cardBlocks[parseInt(idx, 10)])
  return s
}

// ── Message rendering ─────────────────────────────────────────────────────

function createMessageEl(msg) {
  const el = document.createElement('div')
  el.className = `chat-msg chat-msg--${msg.role}`
  if (msg.role === 'user') {
    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble msg-bubble--user'
    bubble.textContent = msg.content
    el.appendChild(bubble)
  } else {
    const bubble = document.createElement('div')
    bubble.className = 'msg-bubble msg-bubble--assistant'
    if (msg.thinking) {
      const thinkingEl = document.createElement('details')
      thinkingEl.className = 'thinking-block'
      const summary = document.createElement('summary')
      summary.textContent = msg.status === 'done' ? 'Thought process' : 'Thinking…'
      thinkingEl.appendChild(summary)
      const thinkBody = document.createElement('div')
      thinkBody.className = 'thinking-body'
      thinkBody.textContent = msg.thinking
      thinkingEl.appendChild(thinkBody)
      bubble.appendChild(thinkingEl)
    }
    const contentEl = document.createElement('div')
    contentEl.className = 'msg-content'
    if (msg.status === 'streaming' && !msg.content) {
      contentEl.innerHTML = '<span class="cursor-blink">▋</span>'
    } else if (msg.content) {
      contentEl.innerHTML = renderMarkdown(msg.content)
      if (msg.status === 'streaming') contentEl.innerHTML += '<span class="cursor-blink">▋</span>'
    }
    bubble.appendChild(contentEl)
    if (msg.status === 'error') {
      bubble.classList.add('msg-bubble--error')
      // Add retry button for errors
      const retryBtn = document.createElement('button')
      retryBtn.className = 'msg-retry-btn'
      retryBtn.textContent = 'Retry'
      retryBtn.addEventListener('click', () => {
        retryLastMessage()
      })
      bubble.appendChild(retryBtn)
    }
    el.appendChild(bubble)
  }
  return el
}

function updateMessageEl(el, msg) {
  if (msg.role === 'user') return
  const bubble = el.querySelector('.msg-bubble--assistant')
  if (!bubble) return
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
    if (msg.status === 'done') {
      const summary = thinkingEl.querySelector('summary')
      if (summary) summary.textContent = 'Thought process'
    }
  }
  const contentEl = bubble.querySelector('.msg-content')
  if (contentEl) {
    if (msg.status === 'streaming' && !msg.content) {
      contentEl.innerHTML = '<span class="cursor-blink">▋</span>'
    } else if (msg.content) {
      contentEl.innerHTML = renderMarkdown(msg.content)
      if (msg.status === 'streaming') contentEl.innerHTML += '<span class="cursor-blink">▋</span>'
    }
  }
  if (msg.status === 'error') bubble.classList.add('msg-bubble--error')
}

/** Re-render the chat area for the active tab */
function renderActiveChat() {
  chatMessages.innerHTML = ''
  const chat = getActiveChat()
  if (!chat || chat.messages.length === 0) {
    renderWelcome()
    return
  }
  for (const msg of chat.messages) {
    chatMessages.appendChild(createMessageEl(msg))
  }
  setStreamingState(chat.isStreaming)
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
    requestAnimationFrame(() => { panelMain.scrollTop = panelMain.scrollHeight })
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
  const chat = getActiveChat()
  if (chat) chat.isStreaming = streaming
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
  if (!text) return
  const chat = getActiveChat()
  if (!chat || chat.isStreaming) return

  chatTextarea.value = ''
  chatTextarea.style.height = 'auto'

  showChatSection()
  clearWelcome()

  shouldAutoScroll = true

  // Add user message (display original text, not with context prefix)
  chat.messages.push({ role: 'user', content: text, thinking: '', status: 'done' })
  chatMessages.appendChild(createMessageEl(chat.messages[chat.messages.length - 1]))
  persistTabChat(activeTabId)

  // Add assistant placeholder
  chat.messages.push({ role: 'assistant', content: '', thinking: '', status: 'streaming' })
  chatMessages.appendChild(createMessageEl(chat.messages[chat.messages.length - 1]))

  setStreamingState(true)
  maybeScrollBottom()

  // Get page context (URL + title) to include with the message
  let pageContext = ''
  try {
    const tab = await chrome.tabs.get(activeTabId)
    if (tab?.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('chrome-extension://')) {
      pageContext = `[User is on: "${tab.title || 'Untitled'}" — ${tab.url}]\n\n`
    }
  } catch { /* ignore */ }

  const messageWithContext = pageContext + text

  // Build history from completed messages (skip the just-added user msg + assistant placeholder)
  const history = chat.messages
    .slice(0, -2)
    .filter(m => m.status === 'done' && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({ role: m.role, content: m.content }))

  // Send to background — include tabId so background knows which tab's chat
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Send timeout')), 30000)
      chrome.runtime.sendMessage(
        { type: 'chat.send', text: messageWithContext, tabId: activeTabId, history },
        (response) => {
          clearTimeout(timer)
          if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
          if (response && !response.ok) { reject(new Error(response.error || 'Send failed')); return }
          resolve(response)
        }
      )
    })
  } catch (err) {
    handleChatError(err instanceof Error ? err.message : String(err))
  }
}

function abortChat() {
  chrome.runtime.sendMessage({ type: 'chat.abort', tabId: activeTabId }, () => {})
  setStreamingState(false)
  hideTypingIndicator()
  const chat = getActiveChat()
  if (!chat) return
  const last = chat.messages[chat.messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'streaming') {
    last.status = 'done'
    if (!last.content) last.content = '*(aborted)*'
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
  }
}

// ── Incoming event handler ────────────────────────────────────────────────

function handleChatToken(delta, tabId) {
  // Only update UI if this event is for the active tab
  const chat = tabId ? getOrCreateTabChat(tabId) : getActiveChat()
  if (!chat) return
  const last = chat.messages[chat.messages.length - 1]
  if (!last || last.role !== 'assistant') return
  last.content += delta
  last.status = 'streaming'
  if (tabId === activeTabId || !tabId) {
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
    maybeScrollBottom()
  }
}

function handleChatThinking(delta, tabId) {
  const chat = tabId ? getOrCreateTabChat(tabId) : getActiveChat()
  if (!chat) return
  const last = chat.messages[chat.messages.length - 1]
  if (!last || last.role !== 'assistant') return
  last.thinking = (last.thinking || '') + delta
  if (tabId === activeTabId || !tabId) {
    const el = getLastAssistantEl()
    if (el) updateMessageEl(el, last)
  }
}

function handleChatDone(fullText, tabId) {
  hideTypingIndicator()
  const resolvedTabId = tabId || activeTabId
  const chat = resolvedTabId ? getOrCreateTabChat(resolvedTabId) : getActiveChat()
  if (!chat) return
  const last = chat.messages[chat.messages.length - 1]
  if (last && last.role === 'assistant') {
    last.status = 'done'
    if (fullText) last.content = fullText
    if (resolvedTabId === activeTabId) {
      const el = getLastAssistantEl()
      if (el) updateMessageEl(el, last)
    }
  }
  chat.isStreaming = false
  if (resolvedTabId === activeTabId) {
    setStreamingState(false)
    maybeScrollBottom()
  }
  // Persist after completion
  if (resolvedTabId) persistTabChat(resolvedTabId)
}

function handleChatCost(costUsd, balanceRemaining) {
  const el = getLastAssistantEl()
  if (!el) return
  const bubble = el.querySelector('.msg-bubble--assistant')
  if (!bubble) return
  const existing = bubble.querySelector('.msg-cost')
  if (existing) existing.remove()
  const costEl = document.createElement('div')
  costEl.className = 'msg-cost'
  const costStr = costUsd < 0.01 ? `$${costUsd.toFixed(4)}` : `$${costUsd.toFixed(2)}`
  const balStr = balanceRemaining != null ? ` · $${balanceRemaining.toFixed(2)} remaining` : ''
  costEl.textContent = costStr + balStr
  bubble.appendChild(costEl)
}

function handleChatError(errMsg, tabId) {
  hideTypingIndicator()
  const resolvedTabId = tabId || activeTabId
  const chat = resolvedTabId ? getOrCreateTabChat(resolvedTabId) : getActiveChat()
  if (!chat) return
  const last = chat.messages[chat.messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'streaming') {
    last.status = 'error'
    last.content = errMsg || 'Something went wrong.'
  } else {
    chat.messages.push({ role: 'assistant', content: errMsg, thinking: '', status: 'error' })
  }
  chat.isStreaming = false
  if (resolvedTabId === activeTabId) {
    renderActiveChat()
    setStreamingState(false)
  }
  // Persist after error
  if (resolvedTabId) persistTabChat(resolvedTabId)
}

/** Retry the last failed message */
function retryLastMessage() {
  const chat = getActiveChat()
  if (!chat || chat.messages.length < 2) return

  // Find the last user message (should be second to last)
  let lastUserMsg = null
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    if (chat.messages[i].role === 'user') {
      lastUserMsg = chat.messages[i].content
      break
    }
  }
  if (!lastUserMsg) return

  // Remove the error message
  const last = chat.messages[chat.messages.length - 1]
  if (last && last.role === 'assistant' && last.status === 'error') {
    chat.messages.pop()
  }

  // Re-render and resend
  renderActiveChat()

  // Add new assistant placeholder
  chat.messages.push({ role: 'assistant', content: '', thinking: '', status: 'streaming' })
  chatMessages.appendChild(createMessageEl(chat.messages[chat.messages.length - 1]))
  setStreamingState(true)
  shouldAutoScroll = true

  chrome.runtime.sendMessage(
    { type: 'chat.send', text: lastUserMsg, tabId: activeTabId },
    (response) => {
      if (response && !response.ok) {
        handleChatError(response.error || 'Retry failed')
      }
    }
  )
}

// ── parseConnectionKey ────────────────────────────────────────────────────

function parseConnectionKey(key) {
  if (!key.startsWith('dopl_')) return null
  try {
    const b64 = key.slice(5).replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(atob(pad))
    return { remoteHost: payload.h || '', port: payload.p || DEFAULT_PORT, token: payload.t || '' }
  } catch { return null }
}

// ── UI helpers ────────────────────────────────────────────────────────────

function setConnectionState(state) {
  statusDot.dataset.state = state
  const labels = { connected: 'Connected', connecting: 'Connecting…', disconnected: 'Disconnected' }
  statusLabel.textContent = labels[state] || 'Unknown'
}

function setFormStatus(kind, message) {
  formStatus.dataset.kind = kind || ''
  formStatus.textContent = message || ''
}

function showSetupSection() {
  setupSection.classList.remove('hidden')
  chatArea.classList.add('hidden')
  chatInputBar.classList.add('hidden')
}

function showChatSection() {
  setupSection.classList.add('hidden')
  chatArea.classList.remove('hidden')
  chatInputBar.classList.remove('hidden')
}

function renderWelcome() {
  const el = document.createElement('div')
  el.className = 'chat-welcome'
  el.innerHTML = `<div class="welcome-icon">✦</div><p class="welcome-text">How can I help you with this page?</p>`
  chatMessages.appendChild(el)
}

function clearWelcome() {
  const w = chatMessages.querySelector('.chat-welcome')
  if (w) w.remove()
}

function updateTabInfo(title, url) {
  // Tab info is now implicit — no footer bar to update
  // Could be used for future header subtitle if needed
}

// ── Tab tracking ──────────────────────────────────────────────────────────

/** Called when the active tab changes — switch chat context */
async function switchToTab(tabId) {
  if (tabId === activeTabId) return
  activeTabId = tabId

  // Ensure this tab is attached in the background
  chrome.runtime.sendMessage({ type: 'panel.autoAttach', tabId }, () => {})

  // Restore persisted chat for this tab if not in memory
  if (!tabChats.has(tabId)) {
    await restoreTabChat(tabId)
  }

  // Re-render chat for this tab
  renderActiveChat()
}

/** Poll the active tab and switch context if it changed */
async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id && tab.id !== activeTabId) {
      await switchToTab(tab.id)
    }
  } catch { /* ignore */ }
}

// ── Background communication ──────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return

  // Events include tabId so we can route to the right chat
  const tabId = msg.tabId || activeTabId

  switch (msg.type) {
    case 'panel.stateChanged':
      applyState(msg)
      break
    case 'chat.token':
      clearWelcome()
      handleChatToken(String(msg.delta || ''), tabId)
      break
    case 'chat.thinking':
      handleChatThinking(String(msg.delta || ''), tabId)
      break
    case 'chat.done':
      handleChatDone(msg.fullText || '', tabId)
      break
    case 'chat.lifecycle':
      if (msg.phase === 'start') showTypingIndicator()
      else if (msg.phase === 'end') {
        hideTypingIndicator()
        const chat = getActiveChat()
        if (chat) {
          const last = chat.messages[chat.messages.length - 1]
          if (last && last.role === 'assistant' && last.status === 'streaming') {
            last.status = 'done'
            const el = getLastAssistantEl()
            if (el) updateMessageEl(el, last)
            setStreamingState(false)
          }
        }
      }
      break
    case 'chat.cost':
      handleChatCost(msg.cost_usd, msg.balance_remaining)
      break
    case 'chat.error':
      handleChatError(msg.message || 'An error occurred.', tabId)
      break
    case 'action.step':
      appendActionStep(msg.description || '', msg.method || '')
      break
    case 'action.done':
      finalizeActionFeed()
      break
    default:
      break
  }
})

// ── Save connection key ───────────────────────────────────────────────────

async function saveConnectionKey() {
  const rawKey = String(connectionKeyInput.value || '').trim()
  if (!rawKey) { setFormStatus('error', 'Please enter a connection key.'); return }
  const parsed = parseConnectionKey(rawKey)
  if (!parsed) { setFormStatus('error', 'Invalid key. Should start with dopl_ from your Settings page.'); return }
  setFormStatus('', 'Saving…')
  try {
    await chrome.storage.local.set({
      connectionKey: rawKey,
      relayPort: parsed.port,
      gatewayToken: parsed.token,
      remoteHost: parsed.remoteHost,
    })
  } catch {
    setFormStatus('error', 'Failed to save.')
    return
  }
  setFormStatus('ok', 'Connected! You can start chatting.')
  // Immediately switch to chat
  showChatSection()
  setConnectionState('connected')
  await checkActiveTab()

  // Tell background to connect relay
  chrome.runtime.sendMessage({ type: 'panel.getState' }, (state) => {
    if (state) applyState(state)
  })
}

// ── Input bar handlers ────────────────────────────────────────────────────

sendBtn.addEventListener('click', () => void sendMessage())
abortBtn.addEventListener('click', () => abortChat())
chatTextarea.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage() }
})
chatTextarea.addEventListener('input', () => {
  chatTextarea.style.height = 'auto'
  chatTextarea.style.height = Math.min(chatTextarea.scrollHeight, 120) + 'px'
})
saveBtn.addEventListener('click', () => void saveConnectionKey())
connectionKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') void saveConnectionKey()
})
// Settings accessible via options page (right-click extension icon → Options)

// ── Action feed ───────────────────────────────────────────────────────────

const ACTION_ICONS = {
  'Page.navigate': '🔍', 'Page.captureScreenshot': '📸', 'Page.reload': '🔄',
  'Runtime.evaluate': '⚡', 'Input.dispatchKeyEvent': '⌨️', 'Input.dispatchMouseEvent': '🖱️',
  'DOM.querySelector': '🎯', 'DOM.querySelectorAll': '🎯',
  'Target.createTarget': '📑', 'Target.closeTarget': '❌', 'Target.activateTarget': '📑',
}

let currentActionGroup = null
let lastActionMethod = ''
let actionStepCount = 0

function getOrCreateActionGroup() {
  if (currentActionGroup) return currentActionGroup
  const group = document.createElement('div')
  group.className = 'action-group'
  chatMessages.appendChild(group)
  currentActionGroup = group
  actionStepCount = 0
  return group
}

function appendActionStep(description, method) {
  const group = getOrCreateActionGroup()
  if (method === lastActionMethod && (method === 'Input.dispatchKeyEvent' || method === 'Input.dispatchMouseEvent')) return
  lastActionMethod = method
  actionStepCount++
  const icon = ACTION_ICONS[method] || '⚙️'
  const step = document.createElement('div')
  step.className = 'action-step'
  step.innerHTML = `<span class="action-icon">${icon}</span><span class="action-text">${escapeHtml(description)}</span>`
  group.appendChild(step)
  maybeScrollBottom()
}

function finalizeActionFeed() {
  if (!currentActionGroup) return
  if (actionStepCount > 0) {
    const done = document.createElement('div')
    done.className = 'action-step action-step--done'
    done.innerHTML = '<span class="action-icon">✅</span><span class="action-text">Done</span>'
    currentActionGroup.appendChild(done)
  }
  currentActionGroup = null
  lastActionMethod = ''
  actionStepCount = 0
  maybeScrollBottom()
}

// ── State application ─────────────────────────────────────────────────────

function applyState(state) {
  if (state.hasConfig === false) {
    showSetupSection()
    setConnectionState('disconnected')
    return
  }
  setConnectionState(state.connected ? 'connected' : 'connecting')
  showChatSection()
}

// ── Tab change detection ──────────────────────────────────────────────────

// Listen for tab activation changes to switch chat context
chrome.tabs.onActivated.addListener(({ tabId }) => {
  void switchToTab(tabId)
})

// Clean up chat when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabChat(tabId)
})

// ── Init ──────────────────────────────────────────────────────────────────

async function init() {
  let stored
  try {
    stored = await chrome.storage.local.get(['connectionKey', 'gatewayToken', 'remoteHost'])
  } catch {
    stored = {}
  }

  const connectionKey = String(stored.connectionKey || '').trim()
  const hasToken = Boolean(stored.gatewayToken || stored.remoteHost)

  if (connectionKey) connectionKeyInput.value = connectionKey

  if (!hasToken) {
    showSetupSection()
    setConnectionState('disconnected')
    return
  }

  setConnectionState('connecting')

  // Get current state from background
  try {
    const state = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 3000)
      chrome.runtime.sendMessage({ type: 'panel.getState' }, (response) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
        resolve(response || {})
      })
    })
    applyState(state)
  } catch {
    showChatSection()
    setConnectionState('connecting')
  }

  // Start tracking the active tab
  await checkActiveTab()
}

void init()
