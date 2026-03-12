/**
 * Dopl Connect — Chat / Messaging
 *
 * Depends on globals from utils.js: escapeHtml, renderMarkdown, formatTimestamp
 * Depends on globals from app.js (DOM refs + state): messagesList, messagesArea,
 *   typingIndicator, msgInput, btnSend, currentConversationId, conversations,
 *   isStreaming, streamingBubble, renderConversationList
 */

async function loadMessages(conversationId) {
  messagesList.innerHTML = '';
  typingIndicator.classList.add('hidden');

  const result = await window.dopl.chat.loadMessages(conversationId);

  // If user switched conversations while we were fetching, discard this response
  if (currentConversationId !== conversationId) return;

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

async function sendMessage() {
  const text = msgInput.value.trim();
  if (!text || isStreaming) return;

  isStreaming = true;
  setInputEnabled(false);

  // Auto-create conversation if none selected
  if (!currentConversationId) {
    try {
      // Use first ~50 chars of the message as the title
      const autoTitle = text.length > 50 ? text.slice(0, 50) + '…' : text;
      const result = await window.dopl.chat.createConversation(autoTitle);
      if (!result.ok) {
        console.error('[Chat] Failed to auto-create conversation:', result.error);
        isStreaming = false;
        setInputEnabled(true);
        return;
      }
      const newConv = result.conversation;
      currentConversationId = newConv.id;
      conversations.unshift(newConv);
      renderConversationList(conversations);
      chatTitle.textContent = newConv.title;
      convSelectorText.textContent = newConv.title;
    } catch (err) {
      console.error('[Chat] Auto-create conversation error:', err);
      isStreaming = false;
      setInputEnabled(true);
      return;
    }
  }

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
  window.dopl.chat.removeStreamListeners();
  window.dopl.chat.onStreamChunk((chunk) => {
    streamedText += chunk;
    // Update the streaming bubble with rendered markdown
    streamingBubble.innerHTML = renderMarkdown(streamedText);
    scrollToBottom();
  });

  // Send — this awaits the full response
  const result = await window.dopl.chat.sendMessage(currentConversationId, text);

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
  window.dopl.chat.removeStreamListeners();

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

function autoResizeInput() {
  msgInput.style.height = 'auto';
  msgInput.style.height = Math.min(msgInput.scrollHeight, 140) + 'px';
}
