/**
 * panel.js — Dopl Cowork Side Panel (Phase 1)
 *
 * Responsibilities:
 *  - Read connection key from chrome.storage.local on load
 *  - Show setup form if no key, ready state if configured
 *  - Listen for state broadcasts from background.js
 *  - Allow saving a new connection key without opening options page
 *  - Display attached tab info queried from background.js
 */

'use strict'

const DEFAULT_PORT = 18134

// ── DOM refs ──────────────────────────────────────────────────────────────

const statusDot   = document.getElementById('status-dot')
const statusLabel = document.getElementById('status-label')
const setupSection  = document.getElementById('setup-section')
const readySection  = document.getElementById('ready-section')
const chatPlaceholder = document.getElementById('chat-placeholder')
const connectionKeyInput = document.getElementById('connection-key')
const saveBtn       = document.getElementById('save-btn')
const formStatus    = document.getElementById('form-status')
const relayValue    = document.getElementById('relay-value')
const hostValue     = document.getElementById('host-value')
const tabsValue     = document.getElementById('tabs-value')
const tabDot        = document.getElementById('tab-dot')
const tabLabel      = document.getElementById('tab-label')
const settingsBtn   = document.getElementById('settings-btn')

// ── parseConnectionKey (mirrors options.js) ───────────────────────────────

/**
 * Parse a `dopl_` connection key into its component parts.
 * @param {string} key
 * @returns {{ remoteHost: string, port: number, token: string }|null}
 */
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
  // state: 'connected' | 'connecting' | 'disconnected'
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
  chatPlaceholder.classList.add('hidden')
}

function showReadySection() {
  setupSection.classList.add('hidden')
  readySection.classList.remove('hidden')
  chatPlaceholder.classList.remove('hidden')
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

/**
 * Ask background.js for current relay + tab state.
 * @returns {Promise<{connected: boolean, windowModeEnabled: boolean, tabs: Array, remoteHost: string, port: number}>}
 */
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
  // 1. Read stored connection key
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
    // No credentials saved — show setup form
    showSetupSection()
    setConnectionState('disconnected')
    return
  }

  // Credentials exist — show ready state and query background for live state
  showReadySection()
  setConnectionState('connecting')

  try {
    const state = await getPanelState()
    applyState(state)
  } catch (err) {
    console.warn('panel: could not get state from background', err)
    // Fall back to showing what we know from storage
    const port = stored.relayPort || DEFAULT_PORT
    const remoteHost = String(stored.remoteHost || '').trim()
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
    // Background says no config — show setup
    showSetupSection()
    setConnectionState('disconnected')
    return
  }

  showReadySection()
  setConnectionState(connected ? 'connected' : 'connecting')
  updateRelayInfo({ remoteHost, port, connected })
  updateTabStatus(tabs)
}

// ── Listen for state broadcasts from background.js ────────────────────────

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || typeof msg !== 'object') return

  if (msg.type === 'panel.stateChanged') {
    applyState(msg)
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

  // Transition to ready view
  showReadySection()
  setConnectionState('connecting')
  updateRelayInfo({ remoteHost: parsed.remoteHost, port: parsed.port, connected: false })
  updateTabStatus([])

  // Ask background for fresh state after a short delay (it may need to reconnect)
  setTimeout(async () => {
    try {
      const state = await getPanelState()
      applyState(state)
    } catch {
      // ignore — state broadcasts will update us
    }
  }, 1500)
}

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
