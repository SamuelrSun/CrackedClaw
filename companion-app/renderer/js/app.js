/**
 * CrackedClaw Connect — App Glue
 *
 * Loads LAST. Declares all DOM references and state as globals,
 * binds all event listeners, and runs the init IIFE.
 *
 * Depends on: utils.js, conversations.js, chat.js (loaded before this file)
 */

// ── DOM References ────────────────────────────────────────────────────────────

const screenSetup = document.getElementById('screen-setup');
const screenChat  = document.getElementById('screen-chat');

// Setup screen
const tokenInput = document.getElementById('token-input');
const btnConnect = document.getElementById('btn-connect');
const errorMsg   = document.getElementById('error-msg');

// Chat screen — core elements
const connDot         = document.getElementById('conn-dot');
const chatHeader      = document.getElementById('chat-header');
const chatTitle       = document.getElementById('chat-title');
const messagesList    = document.getElementById('messages-list');
const messagesArea    = document.getElementById('messages-area');
const typingIndicator = document.getElementById('typing-indicator');
const msgInput        = document.getElementById('msg-input');
const btnSend         = document.getElementById('btn-send');

// Chat screen — panel + navigation
const chatPanel        = document.getElementById('chat-panel');
const convDropdown     = document.getElementById('conv-dropdown');
const convList         = document.getElementById('conv-list');
const convSelector     = document.getElementById('conv-selector');
const convSelectorText = document.getElementById('conv-selector-text');
const btnNewChat       = document.getElementById('btn-new-chat');
const btnDisconnect    = document.getElementById('btn-disconnect');
const btnToggleChat    = document.getElementById('btn-toggle-chat');
const btnAudio         = document.getElementById('btn-audio');

// Tint controls
const btnTint        = document.getElementById('btn-tint');
const tintRow        = document.getElementById('tint-row');
const tintSlider     = document.getElementById('tint-slider');
const tintValueLabel = document.getElementById('tint-value-label');

// ── State ─────────────────────────────────────────────────────────────────────

let currentConversationId = null;
let conversations = [];
let isStreaming = false;
let streamingBubble = null; // The DOM element being built during streaming
let chatPanelVisible = true;
let dropdownOpen = false;
let tintRowOpen = false;

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
  } catch (e) {
    // Fallback: use CSS default (0.15)
    applyGlassTint(0.15);
  }
}

// ── Screen Management ──────────────────────────────────────────────────────────

function showScreen(name) {
  screenSetup.classList.toggle('active', name === 'setup');
  screenChat.classList.toggle('active', name === 'chat');
}

function showSetupError(msg) {
  if (!msg) { errorMsg.textContent = ''; return; }
  // Show a clean, short error — full details go to console
  console.error('[Setup Error]', msg);
  // Extract the first meaningful line (before npm noise)
  const firstLine = msg.split('\n')[0].replace(/^Error:\s*/, '');
  errorMsg.textContent = firstLine.length > 200 ? firstLine.slice(0, 200) + '…' : firstLine;
}

// ── Connection Status ──────────────────────────────────────────────────────────

function setConnectedIndicator(connected) {
  connDot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
  connDot.title = connected ? 'Connected' : 'Disconnected';
}

// ── Chat Panel Toggle ──────────────────────────────────────────────────────────

let expandedHeight = 500; // remember the height when panel is open (no tint row)

/**
 * Dynamically measure the window height needed when the chat panel is collapsed
 * (only the input bar wrapper is visible).
 */
function measureCollapsedHeight() {
  const inputWrapper = document.querySelector('.input-bar-wrapper');
  const screenEl = document.getElementById('screen-chat');
  if (!inputWrapper || !screenEl) return 70; // safe fallback
  const style = window.getComputedStyle(screenEl);
  const vPad = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  return Math.ceil(inputWrapper.offsetHeight + vPad);
}

async function setChatPanelVisible(visible) {
  chatPanelVisible = visible;
  chatPanel.classList.toggle('panel-hidden', !visible);

  if (visible) {
    // Expand back to saved height
    window.crackedclaw.windowSetSize(null, expandedHeight, true);
  } else {
    // Close tint row first so expandedHeight stays clean for the next expand
    if (tintRowOpen) {
      tintRowOpen = false;
      tintRow.classList.add('hidden');
      btnTint.classList.remove('active');
    }
    // Save current height (before collapse) so we can restore it on expand
    const size = await window.crackedclaw.windowGetSize();
    expandedHeight = size[1];
    // Measure after DOM reflects panel-hidden, then animate to exact input-bar height
    requestAnimationFrame(() => {
      const h = measureCollapsedHeight();
      window.crackedclaw.windowSetSize(null, h, true);
    });
  }
}

// ── Conversation Dropdown ──────────────────────────────────────────────────────

function openDropdown() {
  dropdownOpen = true;
  convDropdown.classList.remove('hidden');
}

function closeDropdown() {
  dropdownOpen = false;
  convDropdown.classList.add('hidden');
}

// ── Window Controls ───────────────────────────────────────────────────────────

document.querySelectorAll('.wc-close').forEach(btn => {
  btn.addEventListener('click', () => window.crackedclaw.windowClose());
});
document.querySelectorAll('.wc-minimize').forEach(btn => {
  btn.addEventListener('click', () => window.crackedclaw.windowMinimize());
});
document.querySelectorAll('.wc-zoom').forEach(btn => {
  btn.addEventListener('click', () => window.crackedclaw.windowZoom());
});

// ── Event Bindings ─────────────────────────────────────────────────────────────

// Tint button: toggle the tint slider row and resize window accordingly
btnTint.addEventListener('click', (e) => {
  e.stopPropagation();
  tintRowOpen = !tintRowOpen;
  btnTint.classList.toggle('active', tintRowOpen);

  if (tintRowOpen) {
    // Show tint row, then measure its rendered height and grow the window
    tintRow.classList.remove('hidden');
    if (chatPanelVisible) {
      requestAnimationFrame(() => {
        const rowH = tintRow.offsetHeight;
        expandedHeight = expandedHeight + rowH;
        window.crackedclaw.windowSetSize(null, expandedHeight, true);
      });
    }
  } else {
    // Measure before hiding so we know how much to shrink
    const rowH = tintRow.offsetHeight;
    tintRow.classList.add('hidden');
    if (chatPanelVisible) {
      expandedHeight = Math.max(200, expandedHeight - rowH);
      window.crackedclaw.windowSetSize(null, expandedHeight, true);
    }
  }
});

// Tint slider: update CSS variable in real-time; persist on release
tintSlider.addEventListener('input', (e) => {
  applyGlassTint(e.target.value);
});

tintSlider.addEventListener('change', (e) => {
  const value = parseFloat(e.target.value);
  window.crackedclaw.setGlassTint(value).catch(() => {});
});

// Chat panel toggle
btnToggleChat.addEventListener('click', () => {
  setChatPanelVisible(!chatPanelVisible);
});

// Conversation dropdown toggle
convSelector.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (dropdownOpen && !convDropdown.contains(e.target) && e.target !== convSelector) {
    closeDropdown();
  }
});

// Prevent dropdown clicks from propagating to document (so clicking inside doesn't close it)
convDropdown.addEventListener('click', (e) => {
  e.stopPropagation();
});

// Audio button (placeholder)
btnAudio.addEventListener('click', () => {
  console.log('Audio transcription coming soon');
});

// New chat button — just resets state; conversation is created on first send
btnNewChat.addEventListener('click', () => {
  closeDropdown();
  currentConversationId = null;
  messagesList.innerHTML = '<div class="msg-empty">Start a conversation below</div>';
  chatTitle.textContent = 'New Chat';
  convSelectorText.textContent = 'New Chat';
  msgInput.disabled = false;
  btnSend.disabled = false;
  msgInput.placeholder = 'Message… (Enter to send)';
  msgInput.focus();

  // Deselect in conversation list
  convList.querySelectorAll('.conv-item').forEach((el) => {
    el.classList.remove('active');
  });
});

// Input: auto-resize and keydown
msgInput.addEventListener('input', autoResizeInput);

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!isStreaming && msgInput.value.trim()) {
      sendMessage();
    }
  }
});

// Send button
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
    await enterChatScreen();
  } else {
    showSetupError(result.error || 'Connection failed');
  }

  btnConnect.disabled = false;
  btnConnect.textContent = 'Connect';
});

// Disconnect button
btnDisconnect.addEventListener('click', async () => {
  await window.crackedclaw.disconnect();
  leaveChatScreen();
});

// ── Chat Screen Lifecycle ──────────────────────────────────────────────────────

async function enterChatScreen() {
  showScreen('chat');
  setConnectedIndicator(false); // Will be updated via status-update event
  setChatPanelVisible(true);
  // Reset title to clean state — prevents "Select a conversation" ghost when switching conversations
  chatTitle.textContent = 'New Chat';
  convSelectorText.textContent = 'New Chat';
  // Enable input immediately — sendMessage will auto-create a conversation if needed
  msgInput.disabled = false;
  msgInput.placeholder = 'Message… (Enter to send)';
  btnSend.disabled = false;
  await loadConversations();
}

function leaveChatScreen() {
  currentConversationId = null;
  conversations = [];
  convList.innerHTML = '';
  messagesList.innerHTML = '';
  chatTitle.textContent = 'Select a conversation';
  convSelectorText.textContent = 'New Chat';
  msgInput.disabled = true;
  btnSend.disabled = true;
  closeDropdown();
  showScreen('setup');
}

// ── Status Updates ─────────────────────────────────────────────────────────────

window.crackedclaw.onStatusUpdate((data) => {
  setConnectedIndicator(data.connected);
});

// ── Initialization ─────────────────────────────────────────────────────────────

(async () => {
  // Load and apply saved glass tint preference immediately
  await loadAndApplyGlassTint();

  const state = await window.crackedclaw.getState();

  if (state.token) {
    // We have a stored token — go straight to chat
    await enterChatScreen();
    setConnectedIndicator(state.connected);
  } else {
    showScreen('setup');
  }
})();
