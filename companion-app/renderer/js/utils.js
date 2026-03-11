/**
 * CrackedClaw Connect — Renderer Utilities
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
