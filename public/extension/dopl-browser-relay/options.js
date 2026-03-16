import { deriveRelayToken } from './background-utils.js'
import { classifyRelayCheckException, classifyRelayCheckResponse } from './options-validation.js'

const DEFAULT_PORT = 18120

function clampPort(value) {
  const n = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(n)) return DEFAULT_PORT
  if (n <= 0 || n > 65535) return DEFAULT_PORT
  return n
}

function updateRelayUrl(port, remoteHost) {
  const el = document.getElementById('relay-url')
  if (!el) return
  const host = String(remoteHost || '').trim()
  if (host) {
    el.textContent = `wss://${host}/relay/extension`
  } else {
    el.textContent = `ws://127.0.0.1:${port}/extension`
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
      setStatus('error', 'Gateway token required. Save your gateway token to connect.')
      return
    }
    setStatus('ok', `Will connect via wss://${host}/relay/extension`)
    return
  }

  // Local connection: check relay reachability via the background service worker.
  const url = `http://127.0.0.1:${port}/json/version`
  const trimmedToken = String(token || '').trim()
  if (!trimmedToken) {
    setStatus('error', 'Gateway token required. Save your gateway token to connect.')
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
  const stored = await chrome.storage.local.get(['relayPort', 'gatewayToken', 'remoteHost'])
  const port = clampPort(stored.relayPort)
  const token = String(stored.gatewayToken || '').trim()
  const remoteHost = String(stored.remoteHost || '').trim()
  document.getElementById('port').value = String(port)
  document.getElementById('token').value = token
  document.getElementById('remote-host').value = remoteHost
  updateRelayUrl(port, remoteHost)
  await checkRelayReachable(port, token, remoteHost)
}

async function save() {
  const portInput = document.getElementById('port')
  const tokenInput = document.getElementById('token')
  const remoteHostInput = document.getElementById('remote-host')
  const port = clampPort(portInput.value)
  const token = String(tokenInput.value || '').trim()
  const remoteHost = String(remoteHostInput.value || '').trim()
  await chrome.storage.local.set({ relayPort: port, gatewayToken: token, remoteHost })
  portInput.value = String(port)
  tokenInput.value = token
  remoteHostInput.value = remoteHost
  updateRelayUrl(port, remoteHost)
  await checkRelayReachable(port, token, remoteHost)
}

document.getElementById('save').addEventListener('click', () => void save())
void load()
