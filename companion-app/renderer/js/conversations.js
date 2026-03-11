/**
 * CrackedClaw Connect — Conversation Management
 *
 * Depends on globals from utils.js: escapeHtml, relativeTime
 * Depends on globals from app.js (loaded after): convList, convDropdown, convSelectorText,
 *   chatTitle, msgInput, btnSend, currentConversationId, conversations,
 *   chatPanelVisible, setChatPanelVisible, closeDropdown, loadMessages
 *
 * Because JS files share global scope (no modules), functions here are globals
 * and reference DOM refs + state defined in app.js (which loads last).
 */

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
