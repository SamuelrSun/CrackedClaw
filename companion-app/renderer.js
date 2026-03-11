/**
 * CrackedClaw Connect — Renderer
 *
 * Architecture:
 *  - All network calls are done in the main process via IPC (window.crackedclaw.*)
 *  - This file handles UI state only: rendering, input, event binding
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
const chatPanel       = document.getElementById('chat-panel');
const convDropdown    = document.getElementById('conv-dropdown');
const convList        = document.getElementById('conv-list');
const convSelector    = document.getElementById('conv-selector');
const convSelectorText = document.getElementById('conv-selector-text');
const btnNewChat      = document.getElementById('btn-new-chat');
const btnDisconnect   = document.getElementById('btn-disconnect');
const btnToggleChat   = document.getElementById('btn-toggle-chat');
const btnAudio        = document.getElementById('btn-audio');

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

// ── State ─────────────────────────────────────────────────────────────────────

let currentConversationId = null;
let conversations = [];
let isStreaming = false;
let streamingBubble = null; // The DOM element being built during streaming
let chatPanelVisible = true;
let dropdownOpen = false;

// ── Utilities ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString();
}

function formatTimestamp(isoString) {
  if (!isoString) return '';
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Very simple markdown-to-HTML renderer.
 * Handles: code blocks, inline code, bold, italic, headers, bullet lists, blockquote, line breaks.
 */
function renderMarkdown(text) {
  if (!text) return '';

  // Protect code blocks first
  const codeBlocks = [];
  let safe = text.replace(/```([\s\S]*?)```/g, (_, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `\x00CODE${idx}\x00`;
  });

  // Protect inline code
  const inlineCodes = [];
  safe = safe.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00INLINE${idx}\x00`;
  });

  // Escape remaining HTML
  safe = escapeHtml(safe);

  // Headers
  safe = safe.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  safe = safe.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  safe = safe.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  safe = safe.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
  safe = safe.replace(/_(.+?)_/g, '<em>$1</em>');

  // Blockquote
  safe = safe.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

  // Bullet lists — wrap consecutive - items in <ul>
  safe = safe.replace(/((?:^- .+\n?)+)/gm, (match) => {
    const items = match
      .split('\n')
      .filter(Boolean)
      .map((line) => `<li>${line.replace(/^- /, '')}</li>`)
      .join('');
    return `<ul>${items}</ul>`;
  });

  // Ordered lists
  safe = safe.replace(/((?:^\d+\. .+\n?)+)/gm, (match) => {
    const items = match
      .split('\n')
      .filter(Boolean)
      .map((line) => `<li>${line.replace(/^\d+\. /, '')}</li>`)
      .join('');
    return `<ol>${items}</ol>`;
  });

  // Paragraphs: split on double newlines
  const paras = safe.split(/\n\n+/);
  safe = paras
    .map((p) => {
      p = p.trim();
      if (!p) return '';
      // Don't wrap block elements in <p>
      if (/^<(h[1-6]|ul|ol|blockquote|pre)/.test(p)) return p;
      // Replace single newlines with <br> inside paragraphs
      return `<p>${p.replace(/\n/g, '<br>')}</p>`;
    })
    .filter(Boolean)
    .join('\n');

  // Restore code blocks
  codeBlocks.forEach((block, idx) => {
    safe = safe.replace(`\x00CODE${idx}\x00`, block);
  });

  // Restore inline code
  inlineCodes.forEach((code, idx) => {
    safe = safe.replace(`\x00INLINE${idx}\x00`, code);
  });

  return safe;
}

// ── Screen Management ──────────────────────────────────────────────────────────

function showScreen(name) {
  screenSetup.classList.toggle('active', name === 'setup');
  screenChat.classList.toggle('active', name === 'chat');
}

function showSetupError(msg) {
  errorMsg.textContent = msg || '';
}

// ── Connection Status ──────────────────────────────────────────────────────────

function setConnectedIndicator(connected) {
  connDot.className = 'conn-dot ' + (connected ? 'connected' : 'disconnected');
  connDot.title = connected ? 'Connected' : 'Disconnected';
}

// ── Chat Panel Toggle ──────────────────────────────────────────────────────────

function setChatPanelVisible(visible) {
  chatPanelVisible = visible;
  chatPanel.classList.toggle('panel-hidden', !visible);
}

btnToggleChat.addEventListener('click', () => {
  setChatPanelVisible(!chatPanelVisible);
});

// ── Conversation Dropdown ──────────────────────────────────────────────────────

function openDropdown() {
  dropdownOpen = true;
  convDropdown.classList.remove('hidden');
}

function closeDropdown() {
  dropdownOpen = false;
  convDropdown.classList.add('hidden');
}

// Toggle dropdown when clicking the selector pill
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

// ── Audio Button (Placeholder) ─────────────────────────────────────────────────

btnAudio.addEventListener('click', () => {
  console.log('Audio transcription coming soon');
});

// ── Conversation List ──────────────────────────────────────────────────────────

async function loadConversations() {
  const result = await window.crackedclaw.chat.listConversations();
  if (!result.ok) {
    console.warn('[Chat] Failed to load conversations:', result.error);
    renderConversationList([]);
    return;
  }
  conversations = result.conversations || [];
  renderConversationList(conversations);
}

function renderConversationList(convs) {
  if (!convs || convs.length === 0) {
    convList.innerHTML = '<div class="conv-list-empty">No conversations yet</div>';
    return;
  }

  convList.innerHTML = convs.map((c) => `
    <div class="conv-item${c.id === currentConversationId ? ' active' : ''}" data-id="${c.id}">
      <div class="conv-item-title">${escapeHtml(c.title || 'Untitled')}</div>
      <div class="conv-item-time">${relativeTime(c.updated_at || c.created_at)}</div>
    </div>
  `).join('');

  // Bind click events
  convList.querySelectorAll('.conv-item').forEach((el) => {
    el.addEventListener('click', () => {
      selectConversation(el.dataset.id);
      closeDropdown();
    });
  });
}

async function selectConversation(id) {
  if (currentConversationId === id) return;
  currentConversationId = id;

  // Update active state in conversation list
  convList.querySelectorAll('.conv-item').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  // Update titles
  const conv = conversations.find((c) => c.id === id);
  const title = conv ? conv.title : 'Chat';
  chatTitle.textContent = title;
  convSelectorText.textContent = title;

  // Show chat panel if hidden
  if (!chatPanelVisible) {
    setChatPanelVisible(true);
  }

  // Enable input BEFORE loading messages (so user can type immediately)
  msgInput.disabled = false;
  msgInput.placeholder = 'Message… (Enter to send, Shift+Enter for new line)';
  btnSend.disabled = false;

  // Load messages (non-blocking — failures don't prevent chatting)
  try {
    await loadMessages(id);
  } catch (err) {
    console.warn('[Chat] Failed to load messages:', err);
    messagesList.innerHTML = '<div class="msg-empty">Start a conversation below</div>';
  }

  msgInput.focus();
}

// ── New Chat ───────────────────────────────────────────────────────────────────

btnNewChat.addEventListener('click', async () => {
  closeDropdown();
  btnNewChat.disabled = true;
  btnNewChat.textContent = 'Creating…';
  try {
    const result = await window.crackedclaw.chat.createConversation('New Chat');
    if (!result.ok) {
      console.warn('[Chat] Failed to create conversation:', result.error);
      // Still let the user chat — create a local-only conversation placeholder
      const localConv = { id: 'local-' + Date.now(), title: 'New Chat', updated_at: new Date().toISOString() };
      conversations.unshift(localConv);
      renderConversationList(conversations);
      await selectConversation(localConv.id);
      return;
    }
    const newConv = result.conversation;
    conversations.unshift(newConv);
    renderConversationList(conversations);
    await selectConversation(newConv.id);
  } finally {
    btnNewChat.disabled = false;
    btnNewChat.textContent = '+ New Chat';
  }
});

// ── Messages ───────────────────────────────────────────────────────────────────

async function loadMessages(conversationId) {
  messagesList.innerHTML = '';
  typingIndicator.classList.add('hidden');

  const result = await window.crackedclaw.chat.loadMessages(conversationId);
  if (!result.ok) {
    messagesList.innerHTML = '<div class="msg-empty">Could not load messages</div>';
    return;
  }

  const messages = result.messages || [];
  if (messages.length === 0) {
    messagesList.innerHTML = '<div class="msg-empty">Start a conversation below</div>';
  } else {
    messages.forEach((m) => appendMessage(m.role, m.content, m.created_at, false));
  }
  scrollToBottom();
}

function appendMessage(role, content, timestamp, animate = true) {
  // Remove "empty" placeholder if present
  const empty = messagesList.querySelector('.msg-empty');
  if (empty) empty.remove();

  const div = document.createElement('div');
  div.className = `message ${role}`;

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (role === 'assistant') {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    // User messages: plain text, preserve newlines
    bubble.innerHTML = escapeHtml(content).replace(/\n/g, '<br>');
  }

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = timestamp ? formatTimestamp(timestamp) : '';

  div.appendChild(bubble);
  div.appendChild(time);
  messagesList.appendChild(div);

  return { div, bubble };
}

function scrollToBottom(smooth = false) {
  messagesArea.scrollTo({
    top: messagesArea.scrollHeight,
    behavior: smooth ? 'smooth' : 'auto',
  });
}

// ── Send Message ───────────────────────────────────────────────────────────────

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isStreaming || !currentConversationId) return;

  isStreaming = true;
  setInputEnabled(false);

  // Show user message immediately
  appendMessage('user', text, new Date().toISOString());
  msgInput.value = '';
  autoResizeInput();
  scrollToBottom(true);

  // Show typing indicator
  typingIndicator.classList.remove('hidden');
  scrollToBottom(true);

  // Create empty assistant bubble for streaming
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

  // Hide typing indicator once we start building the bubble
  typingIndicator.classList.add('hidden');

  // Register stream chunk handler
  let streamedText = '';
  window.crackedclaw.chat.removeStreamListeners();
  window.crackedclaw.chat.onStreamChunk((chunk) => {
    streamedText += chunk;
    // Update the streaming bubble with rendered markdown
    streamingBubble.innerHTML = renderMarkdown(streamedText);
    scrollToBottom();
  });

  // Send — this awaits the full response
  const result = await window.crackedclaw.chat.sendMessage(currentConversationId, text);

  // Finalize the bubble
  streamingBubble.classList.remove('streaming');
  if (result.ok && result.content) {
    streamingBubble.innerHTML = renderMarkdown(result.content);
  } else if (!result.ok) {
    streamingBubble.innerHTML = `<span style="color:var(--error)">Error: ${escapeHtml(result.error || 'Unknown error')}</span>`;
  }
  time.textContent = formatTimestamp(new Date().toISOString());
  streamingBubble = null;

  // Clean up listeners
  window.crackedclaw.chat.removeStreamListeners();

  scrollToBottom(true);

  // Update the conversation's updated_at in our local list and re-render
  const convIdx = conversations.findIndex((c) => c.id === currentConversationId);
  if (convIdx !== -1) {
    conversations[convIdx].updated_at = new Date().toISOString();
    // Move to top
    const [updated] = conversations.splice(convIdx, 1);
    conversations.unshift(updated);
    renderConversationList(conversations);
  }

  isStreaming = false;
  setInputEnabled(true);
  msgInput.focus();
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

// ── Input Handling ─────────────────────────────────────────────────────────────

function autoResizeInput() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
}

msgInput.addEventListener('input', autoResizeInput);

msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!isStreaming && msgInput.value.trim() && currentConversationId) {
      sendMessage();
    }
  }
});

btnSend.addEventListener('click', () => {
  if (!isStreaming && msgInput.value.trim() && currentConversationId) {
    sendMessage();
  }
});

// ── Setup Screen Handlers ──────────────────────────────────────────────────────

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

btnDisconnect.addEventListener('click', async () => {
  await window.crackedclaw.disconnect();
  leaveChatScreen();
});

// ── Chat Screen Lifecycle ──────────────────────────────────────────────────────

async function enterChatScreen() {
  showScreen('chat');
  setConnectedIndicator(false); // Will be updated via status-update event
  setChatPanelVisible(true);
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
  const state = await window.crackedclaw.getState();

  if (state.token) {
    // We have a stored token — go straight to chat
    await enterChatScreen();
    setConnectedIndicator(state.connected);
  } else {
    showScreen('setup');
  }
})();
