/**
 * CrackedClaw Connect — Input Bar Window
 *
 * Handles: setup screen, connection dot, text input, message sending,
 * chat panel toggle, settings gear dropdown (tint slider + relink).
 *
 * Depends on: utils.js (escapeHtml, relativeTime, formatTimestamp, renderMarkdown)
 */

// ── DOM References ─────────────────────────────────────────────────────────────

const screenSetup = document.getElementById('screen-setup');
const screenChat  = document.getElementById('screen-chat');

// Setup screen
const tokenInput = document.getElementById('token-input');
const btnConnect = document.getElementById('btn-connect');
const errorMsg   = document.getElementById('error-msg');

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

// Heights (px) — must match main process constants
const INPUT_BAR_HEIGHT = 68;
const SETUP_HEIGHT = 340;
const DROPDOWN_GAP = 6;

// ── Helpers ────────────────────────────────────────────────────────────────────

function showSetupError(msg) {
  if (!msg) { errorMsg.textContent = ''; return; }
  console.error('[Setup Error]', msg);
  const firstLine = msg.split('\n')[0].replace(/^Error:\s*/, '');
  errorMsg.textContent = firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine;
}

function setConnectedIndicator(connected) {
  connDot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
  connDot.title = connected ? 'Connected' : 'Disconnected';
}

function setInputEnabled(enabled) {
  msgInput.disabled = !enabled;
  btnSend.disabled = !enabled;
  if (enabled) {
    msgInput.placeholder = 'Message… (Enter to send, Shift+Enter for new line)';
  } else {
    msgInput.placeholder = 'Waiting for response…';
  }
}

function autoResizeInput() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
}

// ── Screen Management ──────────────────────────────────────────────────────────

function showScreen(name) {
  if (name === 'setup') {
    screenSetup.classList.add('active');
    screenChat.classList.remove('active');
    // Expand window upward to show setup card
    window.crackedclaw.windowSetSize(680, SETUP_HEIGHT, true);
  } else {
    screenSetup.classList.remove('active');
    screenChat.classList.add('active');
    // Collapse to just the input bar
    window.crackedclaw.windowSetSize(680, INPUT_BAR_HEIGHT, false);
  }
}

// ── Glass Tint ────────────────────────────────────────────────────────────────

function applyGlassTint(value) {
  const v = parseFloat(value);
  document.documentElement.style.setProperty('--glass-tint-opacity', v);
  tintSlider.value = v;
  tintValueLabel.textContent = Math.round(v * 100) + '%';
}

async function loadAndApplyGlassTint() {
  try {
    const saved = await window.crackedclaw.getGlassTint();
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
    window.crackedclaw.windowSetSize(680, dropdownH + DROPDOWN_GAP + INPUT_BAR_HEIGHT, false);
  });
}

function closeSettings() {
  if (!settingsOpen) return;
  settingsOpen = false;
  btnSettings.classList.remove('active');
  settingsDropdown.classList.add('hidden');
  // Shrink window back to just the pill
  window.crackedclaw.windowSetSize(680, INPUT_BAR_HEIGHT, false);
}

// ── Toggle chat panel ──────────────────────────────────────────────────────────

function updateToggleButton(visible) {
  chatPanelOpen = visible;
  btnToggleChat.style.opacity = visible ? '1' : '0.5';
  btnToggleChat.title = visible ? 'Hide chat panel' : 'Show chat panel';
}

// ── Sending Messages ───────────────────────────────────────────────────────────

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isStreaming) return;

  isStreaming = true;
  setInputEnabled(false);

  // Auto-create a conversation if we don't have one
  let convId = currentConversationId;
  if (!convId) {
    try {
      const autoTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      const result = await window.crackedclaw.chat.createConversation(autoTitle);
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
      window.crackedclaw.selectConversation(newConv.id, newConv.title);
    } catch (err) {
      console.error('[InputBar] Auto-create conversation error:', err);
      isStreaming = false;
      setInputEnabled(true);
      return;
    }
  }

  // Open chat panel if it's closed so the user sees the response
  if (!chatPanelOpen) {
    window.crackedclaw.showChatPanel();
  }

  msgInput.value = '';
  autoResizeInput();

  // Send — main pushes user message + stream chunks to chat panel
  const result = await window.crackedclaw.chat.sendMessage(convId, text);

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
  window.crackedclaw.setGlassTint(value).catch(() => {});
});

// Relink button — close settings and show setup screen
btnRelink.addEventListener('click', () => {
  closeSettings();
  showScreen('setup');
});

// Toggle chat panel
btnToggleChat.addEventListener('click', () => {
  window.crackedclaw.toggleChatPanel();
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

btnSend.addEventListener('click', () => {
  if (!isStreaming && msgInput.value.trim()) {
    sendMessage();
  }
});

// Connect button
btnConnect.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showSetupError('Please paste a connection token');
    return;
  }
  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting…';
  showSetupError('');

  const result = await window.crackedclaw.connect(token);
  if (result.ok) {
    tokenInput.value = '';
    enterChatScreen();
  } else {
    showSetupError(result.error || 'Connection failed');
  }

  btnConnect.disabled = false;
  btnConnect.textContent = 'Connect';
});

// ── Screen Lifecycle ───────────────────────────────────────────────────────────

function enterChatScreen() {
  setConnectedIndicator(false);
  msgInput.disabled = false;
  msgInput.placeholder = 'Message… (Enter to send)';
  btnSend.disabled = false;
  currentConversationId = null;
  showScreen('chat');
}

function leaveChatScreen() {
  currentConversationId = null;
  msgInput.disabled = true;
  btnSend.disabled = true;
  closeSettings();
  showScreen('setup');
}

// ── IPC Listeners ──────────────────────────────────────────────────────────────

window.crackedclaw.onStatusUpdate((data) => {
  setConnectedIndicator(data.connected);
  // If explicitly disconnected (token cleared), go back to setup screen
  if (data.disconnected) {
    leaveChatScreen();
  }
});

window.crackedclaw.onChatPanelState((data) => {
  updateToggleButton(data.visible);
});

// When the chat panel selects a conversation, sync our local currentConversationId
window.crackedclaw.onConversationSelected((data) => {
  currentConversationId = data.id || null;
});

// Keep tint in sync if changed from another source
window.crackedclaw.onGlassTintChanged((value) => {
  applyGlassTint(value);
});

// ── Initialization ─────────────────────────────────────────────────────────────

(async () => {
  await loadAndApplyGlassTint();

  const state = await window.crackedclaw.getState();
  const panelVisible = await window.crackedclaw.getChatPanelVisible();
  updateToggleButton(panelVisible);

  if (state.token) {
    enterChatScreen();
    setConnectedIndicator(state.connected);
  } else {
    showScreen('setup');
  }
})();
