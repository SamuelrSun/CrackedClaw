/**
 * Dopl Connect — Renderer Utilities
 * Pure functions, no dependencies on DOM or state.
 */

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
 * Parse [[special:tags]] and render as UI cards.
 * Called on the raw text BEFORE renderMarkdown.
 */
function parseAndRenderCards(text) {
  if (!text || !text.includes('[[')) return { html: null, hasCards: false };

  const segments = [];
  let lastIndex = 0;
  // Match [[type:param1:param2:...]]
  const tagRegex = /\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = tagRegex.exec(text)) !== null) {
    // Add text before the tag
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    const parts = match[1].split(':');
    const tagType = parts[0];

    if (tagType === 'integrations' && parts[1] === 'resolve') {
      const services = parts.slice(2);
      services.forEach(service => {
        segments.push({ type: 'integration-card', service });
      });
    } else if (tagType === 'browser') {
      segments.push({ type: 'browser-card', url: parts[1], status: parts[2], message: parts.slice(3).join(':') });
    } else if (tagType === 'task') {
      segments.push({ type: 'task-card', status: parts[1], title: parts[2], details: parts.slice(3).join(':') });
    } else {
      // Unknown tag, keep as text
      segments.push({ type: 'text', content: match[0] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  if (!segments.some(s => s.type !== 'text')) {
    return { html: null, hasCards: false };
  }

  // Render segments
  let html = '';
  for (const seg of segments) {
    if (seg.type === 'text') {
      html += renderMarkdown(seg.content);
    } else if (seg.type === 'integration-card') {
      html += renderIntegrationCard(seg.service);
    } else if (seg.type === 'browser-card') {
      html += renderBrowserCard(seg.url, seg.status, seg.message);
    } else if (seg.type === 'task-card') {
      html += renderTaskCard(seg.status, seg.title, seg.details);
    }
  }

  return { html, hasCards: true };
}

function renderIntegrationCard(service) {
  const serviceNames = {
    google: 'Google Workspace',
    linkedin: 'LinkedIn',
    instagram: 'Instagram',
    twitter: 'Twitter / X',
    github: 'GitHub',
    whatsapp: 'WhatsApp',
    facebook: 'Facebook',
  };
  const name = serviceNames[service.toLowerCase()] || service;
  const isOAuth = ['google', 'github'].includes(service.toLowerCase());

  return `
    <div class="card-integration" data-service="${escapeHtml(service)}">
      <div class="card-integration-header">
        <img class="card-integration-icon"
             src="https://${escapeHtml(service.toLowerCase())}.com/favicon.ico"
             onerror="this.style.display='none'"
             alt="" />
        <div class="card-integration-info">
          <span class="card-integration-name">${escapeHtml(name)}</span>
          <span class="card-integration-type">${isOAuth ? 'OAuth' : 'Uses your browser'}</span>
        </div>
      </div>
      <div class="card-integration-action">
        <span class="card-integration-hint">${isOAuth ? 'Connect via the web app' : 'Requires Dopl Connect'}</span>
      </div>
    </div>
  `;
}

function renderBrowserCard(url, status, message) {
  const statusColors = {
    'waiting-login': 'var(--warning, #f59e0b)',
    'browsing': 'var(--accent, #60a5fa)',
    'complete': 'var(--success, #34d399)',
    'error': 'var(--error, #f87171)',
  };
  const color = statusColors[status] || 'var(--text-secondary)';

  return `
    <div class="card-browser">
      <div class="card-browser-status" style="border-left: 3px solid ${color}">
        <span class="card-browser-url">${escapeHtml(url || '')}</span>
        <span class="card-browser-message">${escapeHtml(message || status || '')}</span>
      </div>
    </div>
  `;
}

function renderTaskCard(status, title, details) {
  const icons = {
    'pending': '⏳',
    'running': '🔄',
    'complete': '✅',
    'error': '❌',
  };
  const icon = icons[status] || '📋';

  return `
    <div class="card-task">
      <div class="card-task-header">
        <span class="card-task-icon">${icon}</span>
        <span class="card-task-title">${escapeHtml(title || 'Task')}</span>
      </div>
      ${details ? `<div class="card-task-details">${escapeHtml(details)}</div>` : ''}
    </div>
  `;
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
