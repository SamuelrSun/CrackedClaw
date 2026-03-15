/**
 * Dopl Connect — Input Bar Window
 *
 * Handles: setup screen, connection dot, text input, message sending,
 * chat panel toggle, settings gear dropdown (tint slider + relink).
 *
 * Depends on: utils.js (escapeHtml, relativeTime, formatTimestamp, renderMarkdown)
 */

// ── DOM References ─────────────────────────────────────────────────────────────

const screenChat  = document.getElementById('screen-chat');

// Chat screen
const connDot       = document.getElementById('conn-dot');
const msgInput      = document.getElementById('msg-input');
const btnSend       = document.getElementById('btn-send');
const btnToggleChat = document.getElementById('btn-toggle-chat');
const btnAudio      = document.getElementById('btn-audio');
const btnSettings   = document.getElementById('btn-settings');

// Settings dropdown
const settingsDropdown = document.getElementById('settings-dropdown');
const tintSlider       = document.getElementById('tint-slider');
const tintValueLabel   = document.getElementById('tint-value-label');
const btnRelink        = document.getElementById('btn-relink');

// ── State ──────────────────────────────────────────────────────────────────────

let currentConversationId = null;
let isStreaming = false;
let settingsOpen = false;
let chatPanelOpen = false;
let tokenMode = false; // true = input bar is in token-paste mode

// Heights (px) — must match main process constants
const INPUT_BAR_HEIGHT = 68;
const SETUP_HEIGHT = 340;
const DROPDOWN_GAP = 6;

// ── Helpers ────────────────────────────────────────────────────────────────────

function setConnectedIndicator(connected, connecting) {
  if (connecting) {
    connDot.className = 'conn-dot connecting';
    connDot.title = 'Connecting…';
  } else {
    connDot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
    connDot.title = connected ? 'Connected' : 'Disconnected';
  }
}

function setInputEnabled(enabled) {
  msgInput.disabled = !enabled;
  btnSend.disabled = !enabled;
  if (tokenMode) return; // don't override placeholder in token mode
  if (enabled) {
    msgInput.placeholder = 'Message… (Enter to send, Shift+Enter for new line)';
  } else {
    msgInput.placeholder = 'Waiting for response…';
  }
}

/**
 * Switch the input bar into token-paste mode.
 * The same pill input becomes the token field; send button becomes connect.
 */
function enterTokenMode() {
  tokenMode = true;
  msgInput.value = '';
  msgInput.disabled = false;
  msgInput.placeholder = '🔗 Paste connection token to link your instance…';
  msgInput.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, monospace';
  msgInput.style.fontSize = '11.5px';
  msgInput.style.letterSpacing = '0.3px';
  btnSend.disabled = false;
  btnSend.title = 'Connect';
  // Hide chat-only buttons when in token mode
  btnAudio.style.display = 'none';
  btnToggleChat.style.display = 'none';
  btnSettings.style.display = 'none';
  setConnectedIndicator(false);
}

/**
 * Switch back to normal chat mode.
 */
function exitTokenMode() {
  tokenMode = false;
  msgInput.value = '';
  msgInput.disabled = false;
  msgInput.placeholder = 'Message… (Enter to send)';
  msgInput.style.fontFamily = '';
  msgInput.style.fontSize = '';
  msgInput.style.letterSpacing = '';
  btnSend.disabled = false;
  btnSend.title = 'Send';
  // Show chat buttons
  btnAudio.style.display = '';
  btnToggleChat.style.display = '';
  btnSettings.style.display = '';
}

function autoResizeInput() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
}

// ── Screen Management ──────────────────────────────────────────────────────────
// No separate setup screen — the input bar handles everything

// ── Glass Tint ────────────────────────────────────────────────────────────────

function applyGlassTint(value) {
  const v = parseFloat(value);
  document.documentElement.style.setProperty('--glass-tint-opacity', v);
  tintSlider.value = v;
  tintValueLabel.textContent = Math.round(v * 100) + '%';
}

async function loadAndApplyGlassTint() {
  try {
    const saved = await window.dopl.getGlassTint();
    applyGlassTint(saved);
  } catch (_) {
    applyGlassTint(0.15);
  }
}

// ── Settings Dropdown ──────────────────────────────────────────────────────────

function openSettings() {
  if (settingsOpen) return;
  settingsOpen = true;
  btnSettings.classList.add('active');
  settingsDropdown.classList.remove('hidden');

  // Expand window upward to show dropdown + gap + pill
  requestAnimationFrame(() => {
    const dropdownH = settingsDropdown.offsetHeight;
    window.dopl.windowSetSize(680, dropdownH + DROPDOWN_GAP + INPUT_BAR_HEIGHT, false);
  });
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  btnSettings.classList.remove('active');
  settingsDropdown.classList.add('hidden');
  // Shrink window back to just the pill
  window.dopl.windowSetSize(680, INPUT_BAR_HEIGHT, false);
}

// ── Toggle chat panel ──────────────────────────────────────────────────────────

function updateToggleButton(visible) {
  chatPanelOpen = visible;
  btnToggleChat.style.opacity = visible ? '1' : '0.5';
  btnToggleChat.title = visible ? 'Hide chat panel' : 'Show chat panel';
}

// ── Token Connection (via the input bar) ───────────────────────────────────────

async function handleTokenSubmit() {
  const token = msgInput.value.trim();
  if (!token) return;

  msgInput.disabled = true;
  btnSend.disabled = true;
  msgInput.value = '';
  msgInput.placeholder = '⏳ Connecting…';
  setConnectedIndicator(false, /* connecting */ true);

  const result = await window.dopl.connect(token);
  if (result.ok) {
    // Show brief success state, then switch to normal chat mode
    msgInput.placeholder = '✅ Connected!';
    setConnectedIndicator(true);
    // Reload conversations so the chat panel populates immediately
    try {
      await window.dopl.chat.listConversations();
    } catch (_) {}
    // Brief pause so user sees the success state
    await new Promise((r) => setTimeout(r, 800));
    exitTokenMode();
    setConnectedIndicator(true);
  } else {
    msgInput.disabled = false;
    btnSend.disabled = false;
    setConnectedIndicator(false);
    const errMsg = (result.error || 'Connection failed').split('\n')[0].replace(/^Error:\s*/, '');
    const shortErr = errMsg.length > 70 ? errMsg.slice(0, 70) + '…' : errMsg;
    // Keep error visible in placeholder AND show a retry hint
    msgInput.placeholder = '❌ ' + shortErr + ' — paste token again to retry';
    // Re-focus so user can immediately paste a new token
    msgInput.focus();
  }
}

// ── Sending Messages ───────────────────────────────────────────────────────────

async function sendMessage() {
  // If in token mode, handle as token submission
  if (tokenMode) {
    handleTokenSubmit();
    return;
  }

  const text = msgInput.value.trim();
  if (!text || isStreaming) return;

  isStreaming = true;
  setInputEnabled(false);

  // Auto-create a conversation if we don't have one
  let convId = currentConversationId;
  if (!convId) {
    try {
      const autoTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      const result = await window.dopl.chat.createConversation(autoTitle);
      if (!result.ok) {
        console.error('[InputBar] Failed to auto-create conversation:', result.error);
        isStreaming = false;
        setInputEnabled(true);
        return;
      }
      const newConv = result.conversation;
      convId = newConv.id;
      currentConversationId = convId;
      // Tell both windows which conversation is now active
      window.dopl.selectConversation(newConv.id, newConv.title);
    } catch (err) {
      console.error('[InputBar] Auto-create conversation error:', err);
      isStreaming = false;
      setInputEnabled(true);
      return;
    }
  }

  // Open chat panel if it's closed so the user sees the response
  if (!chatPanelOpen) {
    window.dopl.showChatPanel();
  }

  msgInput.value = '';
  autoResizeInput();

  // Send — main pushes user message + stream chunks to chat panel
  const result = await window.dopl.chat.sendMessage(convId, text);

  if (!result.ok) {
    console.error('[InputBar] Send error:', result.error);
  }

  isStreaming = false;
  setInputEnabled(true);
  msgInput.focus();
}

// ── Event Bindings ─────────────────────────────────────────────────────────────

// Settings gear button toggles dropdown
btnSettings.addEventListener('click', (e) => {
  e.stopPropagation();
  if (settingsOpen) {
    closeSettings();
  } else {
    openSettings();
  }
});

// Close settings dropdown on outside click
document.addEventListener('click', (e) => {
  if (settingsOpen && !settingsDropdown.contains(e.target) && e.target !== btnSettings) {
    closeSettings();
  }
});

settingsDropdown.addEventListener('click', (e) => e.stopPropagation());

// Tint slider — live preview
tintSlider.addEventListener('input', (e) => {
  applyGlassTint(e.target.value);
});

// Tint slider — commit + broadcast on release
tintSlider.addEventListener('change', (e) => {
  const value = parseFloat(e.target.value);
  window.dopl.setGlassTint(value).catch(() => {});
});

// Relink button — close settings and switch to token mode
btnRelink.addEventListener('click', () => {
  closeSettings();
  enterTokenMode();
  msgInput.focus();
});

// Toggle chat panel
btnToggleChat.addEventListener('click', () => {
  window.dopl.toggleChatPanel();
});

// Audio (placeholder)
btnAudio.addEventListener('click', () => {
  console.log('Audio transcription coming soon');
});

// Message input
msgInput.addEventListener('input', autoResizeInput);
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!isStreaming && msgInput.value.trim()) {
      sendMessage();
    }
  }
});

btnSend.addEventListener('click', async () => {
  // Runtime retry mode — send button acts as retry
  if (btnSend._runtimeRetry) {
    btnSend._runtimeRetry = false;
    btnSend.disabled = true;
    msgInput.placeholder = '🔄 Retrying setup…';
    try {
      const result = await window.dopl.runtime.retry();
      if (!result.ok) {
        // Will be handled by the onStatus listener
      }
    } catch (_) {
      msgInput.placeholder = '❌ Retry failed — click send ↗ to try again';
      btnSend._runtimeRetry = true;
      btnSend.disabled = false;
    }
    return;
  }
  if (!isStreaming && msgInput.value.trim()) {
    sendMessage();
  }
});

// No separate connect button — handled by sendMessage() in token mode

// ── Screen Lifecycle ───────────────────────────────────────────────────────────

function enterChatMode() {
  exitTokenMode();
  setConnectedIndicator(false);
  currentConversationId = null;
}

function enterSetupMode() {
  currentConversationId = null;
  closeSettings();
  enterTokenMode();
}

// ── IPC Listeners ──────────────────────────────────────────────────────────────

window.dopl.onStatusUpdate((data) => {
  setConnectedIndicator(data.connected, data.connecting);
  // If explicitly disconnected (token cleared), switch input bar to token mode
  if (data.disconnected) {
    enterSetupMode();
  }
});

window.dopl.onChatPanelState((data) => {
  updateToggleButton(data.visible);
});

// When the chat panel selects a conversation, sync our local currentConversationId
window.dopl.onConversationSelected((data) => {
  currentConversationId = data.id || null;
});

// Keep tint in sync if changed from another source
window.dopl.onGlassTintChanged((value) => {
  applyGlassTint(value);
});

// ── Click-through: pass mouse events on transparent areas ──────────────────────

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overInteractive = !!(el && (
    el.closest('.input-bar-glass') ||
    el.closest('.settings-dropdown') ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'BUTTON' ||
    el.tagName === 'INPUT'
  ));
  window.dopl.setIgnoreMouseEvents(!overInteractive);
});

// ── Runtime Setup Progress ─────────────────────────────────────────────────────

/**
 * Apply runtime status to the input field.
 * Called both on initial status check and on live status updates.
 */
function applyRuntimeStatus(status, detail, isConnected) {
  if (status === 'downloading-node') {
    msgInput.placeholder = '⬇️ Downloading runtime… (first time only, ~40MB)';
    msgInput.disabled = true;
    btnSend.disabled = true;
  } else if (status === 'installing-openclaw') {
    msgInput.placeholder = '⚙️ Installing components… (almost there)';
    msgInput.disabled = true;
    btnSend.disabled = true;
  } else if (status === 'ready' || status === 'checking') {
    // Runtime ready — restore normal UI state
    if (msgInput.disabled && !isStreaming) {
      msgInput.disabled = false;
      btnSend.disabled = false;
      msgInput.placeholder = isConnected
        ? 'Message… (Enter to send, Shift+Enter for new line)'
        : '🔗 Paste connection token to link your instance…';
    }
  } else if (status === 'error') {
    const shortErr = (detail || 'unknown error').split('\n')[0];
    const displayErr = shortErr.length > 50 ? shortErr.slice(0, 50) + '…' : shortErr;
    msgInput.placeholder = `❌ ${displayErr} — click send ↗ to retry`;
    msgInput.disabled = true;
    btnSend.disabled = false;
    // Hijack send button to retry runtime setup
    btnSend._runtimeRetry = true;
  }
}

// Listen for real-time runtime status changes pushed from main process
if (window.dopl.runtime && window.dopl.runtime.onStatus) {
  window.dopl.runtime.onStatus((status, detail) => {
    // Determine if we're currently connected (for placeholder restoration)
    const connDotConnected = connDot.classList.contains('connected');
    applyRuntimeStatus(status, detail, connDotConnected && !tokenMode);
  });
}

// ── Initialization ─────────────────────────────────────────────────────────────

(async () => {
  await loadAndApplyGlassTint();

  const state = await window.dopl.getState();
  const panelVisible = await window.dopl.getChatPanelVisible();
  updateToggleButton(panelVisible);

  // Always start at input bar height — no setup card expansion
  window.dopl.windowSetSize(680, INPUT_BAR_HEIGHT, false);

  if (state.token) {
    exitTokenMode();
    setConnectedIndicator(state.connected, false);
  } else {
    enterTokenMode();
  }

  // Check runtime status and apply to UI if setup is still in progress
  if (window.dopl.runtime && window.dopl.runtime.status) {
    try {
      const runtimeStatus = await window.dopl.runtime.status();
      if (runtimeStatus && runtimeStatus.status !== 'ready' && runtimeStatus.status !== 'checking') {
        applyRuntimeStatus(runtimeStatus.status, runtimeStatus.error, state.connected);
      }
    } catch (_) {
      // Non-fatal — runtime IPC unavailable in older builds
    }
  }
})();
