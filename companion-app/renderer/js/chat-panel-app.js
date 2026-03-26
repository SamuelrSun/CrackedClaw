/**
 * Dopl Connect — Chat Panel Window
 *
 * Handles: message display, streaming, conversation list,
 * open-in-browser button, close (X) button.
 *
 * Depends on: utils.js (escapeHtml, relativeTime, formatTimestamp, renderMarkdown)
 */

// ── DOM References ─────────────────────────────────────────────────────────────

const chatHeader          = document.getElementById('chat-header');
const chatTitle           = document.getElementById('chat-title');
const messagesList        = document.getElementById('messages-list');
const messagesArea        = document.getElementById('messages-area');
const typingIndicator     = document.getElementById('typing-indicator');
const btnClosePanel       = document.getElementById('btn-close-panel');
const btnOpenInBrowser    = document.getElementById('btn-open-in-browser');
const panelConvSelector   = document.getElementById('panel-conv-selector');
const panelConvDropdown   = document.getElementById('panel-conv-dropdown');
const convList            = document.getElementById('conv-list');
const btnNewChat          = document.getElementById('btn-new-chat');

// ── State ──────────────────────────────────────────────────────────────────────

let currentConversationId = null;
let conversations = [];
let streamingBubble = null;
let streamedText = '';
let dropdownOpen = false;
let webAppUrl = 'https://usedopl.com';

// ── Glass Tint ────────────────────────────────────────────────────────────────

function applyGlassTint(value) {
  const v = parseFloat(value);
  document.documentElement.style.setProperty('--glass-tint-opacity', v);
}

async function loadAndApplyGlassTint() {
  try {
    const saved = await window.dopl.getGlassTint();
    applyGlassTint(saved);
  } catch (_) {
    applyGlassTint(0.15);
  }
}

// ── Messages ──────────────────────────────────────────────────────────────────

function clearMessages(placeholder) {
  messagesList.innerHTML = placeholder
    ? `<div class="msg-empty">${placeholder}</div>`
    : '';
  typingIndicator.classList.add('hidden');
}

function appendMessage(role, content, timestamp) {
  const empty = messagesList.querySelector('.msg-empty');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  }

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = timestamp ? formatTimestamp(timestamp) : '';

  div.appendChild(bubble);
  div.appendChild(time);
  messagesList.appendChild(div);

  return { div, bubble, time };
}

function scrollToBottom(smooth = false) {
  messagesArea.scrollTo({
    top: messagesArea.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

async function loadMessages(conversationId) {
  clearMessages('');
  typingIndicator.classList.add('hidden');

  const result = await window.dopl.chat.loadMessages(conversationId);

  // Guard: user may have switched conversation while loading
  if (currentConversationId !== conversationId) return;

  if (!result.ok) {
    clearMessages('Could not load messages');
    return;
  }

  const messages = result.messages || [];
  if (messages.length === 0) {
    clearMessages('Start a conversation below');
  } else {
    messages.forEach((m) => appendMessage(m.role, m.content, m.created_at));
  }
  scrollToBottom();
}

// ── Streaming ─────────────────────────────────────────────────────────────────

function startStreamingBubble() {
  const empty = messagesList.querySelector('.msg-empty');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = 'message assistant';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble streaming';
  bubble.innerHTML = '';

  const time = document.createElement('div');
  time.className = 'message-time';

  div.appendChild(bubble);
  div.appendChild(time);
  messagesList.appendChild(div);

  streamingBubble = bubble;
  streamingBubble._timeEl = time;
  streamedText = '';

  return { bubble, time };
}

function finalizeStreamingBubble(ok, content, error) {
  if (!streamingBubble) return;
  streamingBubble.classList.remove('streaming');
  if (ok && content) {
    streamingBubble.innerHTML = renderMarkdown(content);
  } else if (!ok) {
    streamingBubble.innerHTML = `<span style="color:var(--error)">Error: ${escapeHtml(error || 'Unknown error')}</span>`;
  }
  if (streamingBubble._timeEl) {
    streamingBubble._timeEl.textContent = formatTimestamp(new Date().toISOString());
  }
  streamingBubble = null;
  streamedText = '';
  scrollToBottom(true);
}

// ── Conversation List ─────────────────────────────────────────────────────────

function renderConversationList(convs) {
  if (!convs || convs.length === 0) {
    convList.innerHTML = '<div class="conv-list-empty">No conversations yet</div>';
    return;
  }
  convList.innerHTML = convs.map((c) => `
    <div class="conv-item${c.id === currentConversationId ? ' active' : ''}"
         data-id="${c.id}" data-title="${escapeHtml(c.title || 'Untitled')}">
      <div class="conv-item-title">${escapeHtml(c.title || 'Untitled')}</div>
    </div>
  `).join('');

  convList.querySelectorAll('.conv-item').forEach((el) => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const title = el.dataset.title;
      closeDropdown();
      selectConversation(id, title, true);
    });
  });
}

async function loadConversations() {
  const result = await window.dopl.chat.listConversations();
  if (result.ok) {
    conversations = result.conversations || [];
    renderConversationList(conversations);
  } else {
    convList.innerHTML = '<div class="conv-list-empty">Failed to load</div>';
  }
}

function selectConversation(id, title, broadcast) {
  // Skip if same conversation (but always handle null → new chat)
  if (id !== null && currentConversationId === id) return;
  currentConversationId = id;

  // Update title
  chatTitle.textContent = '';
  void chatTitle.offsetHeight; // force reflow
  chatTitle.textContent = title || 'New Chat';

  // Update open-in-browser button state
  updateOpenInBrowserButton();

  // Re-render list for active highlight
  renderConversationList(conversations);

  if (broadcast) {
    // Notify input bar (and re-notify ourselves — we guard against no-op above)
    window.dopl.selectConversation(id, title);
  }

  if (id === null) {
    clearMessages('Start a conversation below');
    return;
  }

  loadMessages(id).catch(console.error);
}

// ── Open in Web App ───────────────────────────────────────────────────────────

function updateOpenInBrowserButton() {
  if (btnOpenInBrowser) {
    btnOpenInBrowser.disabled = !currentConversationId;
  }
}

function openInBrowser() {
  const url = currentConversationId
    ? `${webAppUrl}/chat/${currentConversationId}`
    : webAppUrl;
  window.dopl.openInBrowser(url);
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function openDropdown() {
  if (dropdownOpen) return;
  dropdownOpen = true;
  loadConversations(); // refresh list when opening
  panelConvDropdown.classList.remove('hidden');
}

function closeDropdown() {
  if (!dropdownOpen) return;
  dropdownOpen = false;
  panelConvDropdown.classList.add('hidden');
}

// ── Event Bindings ─────────────────────────────────────────────────────────────

// X button — close this window
btnClosePanel.addEventListener('click', () => {
  window.dopl.closeChatPanel();
});

// Open in browser
btnOpenInBrowser.addEventListener('click', () => {
  openInBrowser();
});

// Conversation selector
panelConvSelector.addEventListener('click', (e) => {
  e.stopPropagation();
  if (dropdownOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
});

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  if (dropdownOpen && !panelConvDropdown.contains(e.target) && e.target !== panelConvSelector) {
    closeDropdown();
  }
});
panelConvDropdown.addEventListener('click', (e) => e.stopPropagation());

// New Chat button
btnNewChat.addEventListener('click', () => {
  closeDropdown();
  selectConversation(null, 'New Chat', true);
});

// ── IPC Listeners ──────────────────────────────────────────────────────────────

window.dopl.onStatusUpdate((data) => {
  console.log('[ChatPanel] Status:', data.connected);
  if (data.connected) {
    // Connection just came alive — refresh UI
    chatTitle.textContent = currentConversationId ? chatTitle.textContent : 'New Chat';
    loadConversations();
    if (!currentConversationId) {
      clearMessages('Start a conversation below');
    }
  } else if (data.disconnected) {
    chatTitle.textContent = 'Not connected';
    clearMessages('Connect from the input bar to start chatting.');
  }
});

// Tint changed from input bar settings dropdown
window.dopl.onGlassTintChanged((value) => {
  applyGlassTint(value);
});

// Input bar selected a conversation (or new chat)
window.dopl.onConversationSelected((data) => {
  const { id, title } = data;
  if (id !== currentConversationId) {
    selectConversation(id, title || 'New Chat', false);
  }
});

// User message received from main (sent before streaming starts)
window.dopl.chat.onShowUserMessage((data) => {
  // Only show if it's for the current conversation
  if (data.conversationId !== currentConversationId) return;

  appendMessage('user', data.content, data.timestamp);
  scrollToBottom(true);

  // Show typing indicator and prepare streaming bubble
  typingIndicator.classList.remove('hidden');
  scrollToBottom(true);
});

// Streaming chunk
window.dopl.chat.onStreamChunk((chunk) => {
  // Hide typing indicator once we start streaming
  typingIndicator.classList.add('hidden');

  // Create the streaming bubble on first chunk
  if (!streamingBubble) {
    startStreamingBubble();
  }

  streamedText += chunk;
  streamingBubble.innerHTML = renderMarkdown(streamedText);
  scrollToBottom();
});

// Message complete
window.dopl.chat.onMessageFinalized((data) => {
  typingIndicator.classList.add('hidden');
  finalizeStreamingBubble(data.ok, data.content, data.error);

  // Update conversation updated_at in our local list
  if (currentConversationId) {
    const idx = conversations.findIndex((c) => c.id === currentConversationId);
    if (idx !== -1) {
      conversations[idx].updated_at = new Date().toISOString();
      const [updated] = conversations.splice(idx, 1);
      conversations.unshift(updated);
      renderConversationList(conversations);
    }
  }
});

// Background message pushed via EventManager (task completed while no active stream)
window.dopl.chat.onPushedMessage((data) => {
  // Only render if the panel is showing this conversation
  if (data.conversationId !== currentConversationId) return;

  // Don't append if we're currently streaming (the stream will finalize it)
  if (streamingBubble) return;

  appendMessage(data.role, data.content, data.timestamp);
  scrollToBottom(true);

  // Update the conversation's updated_at so it floats to the top of the list
  if (data.conversationId) {
    const idx = conversations.findIndex((c) => c.id === data.conversationId);
    if (idx !== -1) {
      conversations[idx].updated_at = data.timestamp || new Date().toISOString();
      const [updated] = conversations.splice(idx, 1);
      conversations.unshift(updated);
      renderConversationList(conversations);
    }
  }
});

// ── Open links in external browser ──────────────────────────────────────────────
// Intercept clicks on markdown-rendered links and open in the default browser
// instead of navigating within the Electron BrowserWindow.
document.addEventListener('click', (e) => {
  const link = e.target.closest('a.md-link, a[href]');
  if (link && link.href && link.href.startsWith('http')) {
    e.preventDefault();
    window.dopl.openInBrowser(link.href);
  }
});

// ── Click-through: pass mouse events on transparent corner areas ───────────────

document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overPanel = !!(el && el.closest('.chat-panel'));
  window.dopl.setIgnoreMouseEvents(!overPanel);
});

// ── Initialization ─────────────────────────────────────────────────────────────

(async () => {
  await loadAndApplyGlassTint();

  const state = await window.dopl.getState();

  // Cache webAppUrl for the open-in-browser feature
  if (state.webAppUrl) {
    webAppUrl = state.webAppUrl;
  }

  // Initialize button state
  updateOpenInBrowserButton();

  const hasToken = state.hasToken || state.token;
  if (hasToken) {
    // Load conversations so the list is ready
    await loadConversations();
    clearMessages('Start a conversation below');
  } else {
    clearMessages('Connect from the input bar to start chatting.');
    chatTitle.textContent = 'Not connected';
  }
})();
