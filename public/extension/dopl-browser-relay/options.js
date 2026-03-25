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

function updateRelayUrl(remoteHost, port) {
  const el = document.getElementById('relay-url')
  if (!el) return
  const host = String(remoteHost || '').trim()
  if (host) {
    el.textContent = `wss://${host}/relay/`
  } else if (port) {
    el.textContent = `ws://127.0.0.1:${port}/extension`
  } else {
    el.textContent = '—'
  }
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
      return
    }
    setStatus('ok', `Will connect via wss://${host}/relay/`)
    return
  }

  // Local connection: check relay reachability via the background service worker.
  const url = `http://127.0.0.1:${port}/json/version`
  const trimmedToken = String(token || '').trim()
  if (!trimmedToken) {
    setStatus('error', 'Gateway token required. Save your connection key to connect.')
    return
  }
  try {
    const relayToken = await deriveRelayToken(trimmedToken, port)
    // Delegate the fetch to the background service worker to bypass
    // CORS preflight on the custom x-openclaw-relay-token header.
    const res = await chrome.runtime.sendMessage({
      type: 'relayCheck',
      url,
      token: relayToken,
    })
    const result = classifyRelayCheckResponse(res, port)
    if (result.action === 'throw') throw new Error(result.error)
    setStatus(result.kind, result.message)
  } catch (err) {
    const result = classifyRelayCheckException(err, port)
    setStatus(result.kind, result.message)
  }
}

async function load() {
  const stored = await chrome.storage.local.get(['connectionKey', 'relayPort', 'gatewayToken', 'remoteHost'])
  const connectionKey = String(stored.connectionKey || '').trim()
  const port = stored.relayPort || DEFAULT_PORT
  const token = String(stored.gatewayToken || '').trim()
  const remoteHost = String(stored.remoteHost || '').trim()

  document.getElementById('connection-key').value = connectionKey
  updateRelayUrl(remoteHost, port)

  if (token || remoteHost) {
    await checkRelayReachable(port, token, remoteHost)
  }
}

async function save() {
  const keyInput = document.getElementById('connection-key')
  const rawKey = String(keyInput.value || '').trim()

  if (!rawKey) {
    setStatus('error', 'Please enter a connection key.')
    return
  }

  const parsed = parseConnectionKey(rawKey)
  if (!parsed) {
    setStatus('error', 'Invalid connection key. It should start with dopl_ and be copied from your Dopl Settings page.')
    return
  }

  const { remoteHost, port, token } = parsed

  await chrome.storage.local.set({
    connectionKey: rawKey,
    relayPort: port,
    gatewayToken: token,
    remoteHost,
  })

  updateRelayUrl(remoteHost, port)
  await checkRelayReachable(port, token, remoteHost)
}

document.getElementById('save').addEventListener('click', () => void save())
void load()
