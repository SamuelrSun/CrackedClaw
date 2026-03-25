import { deriveRelayToken } from './background-utils.js'
import { classifyRelayCheckException, classifyRelayCheckResponse } from './options-validation.js'

const DEFAULT_PORT = 18134

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

function showConnectionBadge(connected) {
  const badge = document.getElementById('connection-status')
  if (badge) badge.style.display = connected ? 'block' : 'none'
}

function setStatus(kind, message) {
  const status = document.getElementById('status')
  if (!status) return
  status.dataset.kind = kind || ''
  status.textContent = message || ''
}

async function checkRelayReachable(port, token, remoteHost) {
  const host = String(remoteHost || '').trim()

  // For remote connections, just show the configured URL — actual auth
  // is verified at WebSocket connect time when the user attaches a tab.
  if (host) {
    const trimmedToken = String(token || '').trim()
    if (!trimmedToken) {
      setStatus('error', 'Gateway token required. Save your connection key to connect.')
      showConnectionBadge(false)
      return
    }
    setStatus('', '')
    showConnectionBadge(true)
    return
  }

  // Local connection: check relay reachability via the background service worker.
  const url = `http://127.0.0.1:${port}/json/version`
  const trimmedToken = String(token || '').trim()
  if (!trimmedToken) {
    setStatus('error', 'Gateway token required. Save your connection key to connect.')
    showConnectionBadge(false)
    return
  }
  try {
    const relayToken = await deriveRelayToken(trimmedToken, port)
    const res = await chrome.runtime.sendMessage({
      type: 'relayCheck',
      url,
      token: relayToken,
    })
    const result = classifyRelayCheckResponse(res, port)
    if (result.action === 'throw') throw new Error(result.error)
    setStatus(result.kind, result.message)
    showConnectionBadge(result.kind === 'ok')
  } catch (err) {
    const result = classifyRelayCheckException(err, port)
    setStatus(result.kind, result.message)
    showConnectionBadge(false)
  }
}

async function load() {
  const stored = await chrome.storage.local.get(['connectionKey', 'relayPort', 'gatewayToken', 'remoteHost'])
  const connectionKey = String(stored.connectionKey || '').trim()
  const port = stored.relayPort || DEFAULT_PORT
  const token = String(stored.gatewayToken || '').trim()
  const remoteHost = String(stored.remoteHost || '').trim()

  document.getElementById('connection-key').value = connectionKey

  if (token || remoteHost) {
    await checkRelayReachable(port, token, remoteHost)
  } else {
    showConnectionBadge(false)
  }
}

async function save() {
  const keyInput = document.getElementById('connection-key')
  const rawKey = String(keyInput.value || '').trim()

  if (!rawKey) {
    setStatus('error', 'Please enter a connection key.')
    showConnectionBadge(false)
    return
  }

  const parsed = parseConnectionKey(rawKey)
  if (!parsed) {
    setStatus('error', 'Invalid connection key. It should start with dopl_ and be copied from your Dopl Settings page.')
    showConnectionBadge(false)
    return
  }

  const { remoteHost, port, token } = parsed

  await chrome.storage.local.set({
    connectionKey: rawKey,
    relayPort: port,
    gatewayToken: token,
    remoteHost,
  })

  await checkRelayReachable(port, token, remoteHost)

  // Tell background to auto-connect relay + enable window mode + open panel
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout')), 10000)
      chrome.runtime.sendMessage({ type: 'config.saved' }, (response) => {
        clearTimeout(timer)
        if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return }
        resolve(response || {})
      })
    })
  } catch {
    // non-fatal — relay connect happens on first chat message anyway
  }
}

document.getElementById('save').addEventListener('click', () => void save())
void load()
