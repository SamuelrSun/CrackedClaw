# Dopl Companion App — Deep Audit Report

**Audited:** `companion-app/` (all source files)  
**Architecture:** Two-window Electron app — `inputBarWindow` (`input-bar.html`) + `chatPanelWindow` (`chat-panel.html`)  
**Date:** 2026-03-14

---

## 1. CLICK-THROUGH BUG 🔴 (ROOT CAUSE FOUND)

### Finding: `setIgnoreMouseEvents` is NEVER called on either window

This is the primary cause of click-blocking. In Electron, a transparent overlay window **blocks all mouse events in its entire bounding rectangle by default**, even in fully transparent areas. The fix is `window.setIgnoreMouseEvents(true, { forward: true })`.

**Neither `inputBarWindow` nor `chatPanelWindow` ever calls `setIgnoreMouseEvents`.**

Search `main/index.js` and `main/ipc.js` — the string `setIgnoreMouseEvents` appears exactly **zero times** in the entire codebase.

**What this means:**
- `inputBarWindow` is **680×68 px**. The actual glass pill is only ~48px tall with 8px body padding. The 20px+ of invisible space above the pill intercepts every click.
- `chatPanelWindow` is **680×460 px** when visible. Its `border-radius: 16px` makes all four corners transparent — those corners still block clicks. But more importantly, the entire window is clickable even on transparent areas.
- After moving either window, the invisible rectangle moves with it — the "blocking persists after move" symptom the user reported is **exactly this**: the bounding box is invisible but always blocks.

### Secondary cause: `-webkit-app-region: drag` on transparent areas

`renderer/styles/base.css` lines 61-64:
```css
html, body, .screen, .screen.active {
  -webkit-app-region: drag;
}
```

This makes the **entire window body** a drag region. In Electron, `-webkit-app-region: drag` regions intercept mouse events at the OS level. So even if `setIgnoreMouseEvents` were set, the transparent padding area (the 8px `padding: 8px` in `input-bar.html`'s body style) would still block clicks because it's a drag region.

### Fix

**In `main/index.js`** — after each window is created, add:
```js
// After inputBarWindow.once('ready-to-show', ...)
inputBarWindow.setIgnoreMouseEvents(true, { forward: true });

// After chatPanelWindow.loadFile(...)
chatPanelWindow.setIgnoreMouseEvents(true, { forward: true });
```

**In `main/ipc.js`** — add an IPC handler so the renderer can toggle per-window:
```js
// Add this to setupIPC():
ipcMain.on('set-ignore-mouse-events', (event, { ignore }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
});
```

**In `renderer/preload.js`** — expose the toggle:
```js
// Add to the contextBridge:
setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', { ignore }),
```

**In `renderer/js/input-bar-app.js`** — add the mousemove-based toggle at the bottom of the file:
```js
// Click-through: ignore mouse events when over transparent areas, capture when over glass
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overInteractive = el && (
    el.closest('.input-bar-glass') ||
    el.closest('.settings-dropdown') ||
    el.tagName === 'TEXTAREA' ||
    el.tagName === 'BUTTON'
  );
  window.dopl.setIgnoreMouseEvents(!overInteractive);
});
```

**In `renderer/js/chat-panel-app.js`** — same pattern:
```js
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overPanel = el && el.closest('.chat-panel');
  window.dopl.setIgnoreMouseEvents(!overPanel);
});
```

**In `renderer/styles/base.css`** — fix the drag region to NOT cover transparent areas:
```css
/* REMOVE the broad drag rule: */
html, body, .screen, .screen.active {
  -webkit-app-region: drag;   /* ← DELETE THIS */
}

/* ADD targeted drag only on the glass surfaces: */
/* (already on .input-bar-glass and .chat-panel-header via inline styles) */
body {
  -webkit-app-region: no-drag;
}
```

---

## 2. CRITICAL BUGS 🔴

### Bug 1: `_approvingPending` is never reset on reconnect cycles

**File:** `main/node-manager.js`

In `spawnNode()`, when a "pairing required" error is detected, `this._approvingPending = true` is set. But on the **next `spawnNode()` call** (reconnect), it's never reset. So after the first pairing attempt (whether it succeeded or failed with an exception), all future pairing-required events are silently ignored.

**Affected lines:** `spawnNode()` — the `if (line.includes('pairing required') && !this._approvingPending)` guard.

**Fix** — at the top of `spawnNode()`, reset the flag:
```js
spawnNode() {
  if (!this.shouldRun) return;
  this._approvingPending = false;  // ← ADD THIS
  // ... rest of method
```

### Bug 2: No single-instance lock

**File:** `main/index.js`

There's no `app.requestSingleInstanceLock()`. Users can accidentally launch two copies of Dopl Connect simultaneously. Both will create overlay windows and connect to the gateway with the same token, causing duplicate messages and double click-blocking.

**Fix** — add at the top of `app.whenReady()`:
```js
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}
app.on('second-instance', () => {
  if (inputBarWindow) inputBarWindow.show();
});
```

### Bug 3: `openclaw node run` args missing `instanceId` — connection will likely fail

**File:** `main/node-manager.js`, `spawnNode()` method

The spawn args are:
```js
const args = [
  'node', 'run',
  '--host', host,
  '--port', String(port),
  '--display-name', displayName,
];
// ...
env: { OPENCLAW_GATEWAY_TOKEN: this.authToken }
```

`this.instanceId` is available but **never passed** to the CLI. The `openclaw node run` command needs to know which instance to identify as. If the CLI doesn't automatically read `OPENCLAW_GATEWAY_TOKEN` (which is a non-standard env var), the node will either fail to authenticate or connect to the wrong instance.

**Fix** — check if `openclaw node run` accepts `--token` and `--instance-id` flags, and pass them:
```js
const args = [
  'node', 'run',
  '--host', host,
  '--port', String(port),
  '--display-name', displayName,
  '--token', this.authToken,
];
if (this.instanceId) args.push('--instance-id', this.instanceId);
```

### Bug 4: Connection detection is brittle stdout string matching

**File:** `main/node-manager.js`, lines in `spawnNode()`:
```js
this.process.stdout.on('data', (data) => {
  const line = data.toString().trim();
  if (line.toLowerCase().includes('connected') || line.toLowerCase().includes('ready')) {
    this.setConnected(true);
  }
});
```

This is fragile — any log line containing "connected" or "ready" sets the status to connected, including error messages like "Failed to connect: connection refused". A CLI update changing the log format will silently break connection detection.

Also: `data` may contain **multiple lines** (buffered output). `.trim()` only trims the outer whitespace of the whole buffer, not individual lines. The check works but could match partial lines.

**Fix** — split on newlines and check each line:
```js
this.process.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    console.log('[openclaw node]', line);
    // Look for explicit connected signal, avoid false positives
    if (line.includes('[gateway] connected') || line.includes('Node ready') || line.match(/^connected$/i)) {
      this.setConnected(true);
    }
  }
});
```

### Bug 5: Streaming fetch has no timeout or abort mechanism

**File:** `main/chat-manager.js`, `sendMessage()` method

```js
const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
  method: 'POST',
  // ...
});
```

No `AbortController`, no timeout. If the gateway drops mid-stream, the `reader.read()` loop hangs indefinitely. This blocks the IPC handler in `ipc.js` which is `await`-ed, which blocks the input bar (`sendMessage` in `input-bar-app.js` `await`s the IPC result), leaving the UI permanently frozen in "Waiting for response…" state.

**Fix** — add an AbortController with a timeout:
```js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120_000); // 2 min max

const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
  method: 'POST',
  signal: controller.signal,
  // ...
});

// ...in the stream loop:
try {
  while (true) {
    const { done, value } = await reader.read();
    // ...
  }
} finally {
  clearTimeout(timeoutId);
  reader.releaseLock();
}
```

---

## 3. FLAKY BEHAVIOR 🟡

### Flake 1: Chat panel doesn't follow input bar when input bar is moved

**File:** `main/index.js`, `positionChatPanel()`

`positionChatPanel()` is only called in `showChatPanel()`. If the user drags the input bar while the chat panel is open, the chat panel stays in its old position — the two windows visually separate.

There's no `moved` event handler on `inputBarWindow`.

**Fix** — in `createInputBarWindow()`, add:
```js
inputBarWindow.on('moved', () => {
  if (chatPanelVisible) positionChatPanel();
});
```

### Flake 2: Streaming bubble state leak across conversations

**File:** `renderer/js/chat-panel-app.js`

If the user switches conversations while a stream is in progress, `streamingBubble` is not cleaned up. The next conversation will receive stream chunks into the wrong DOM node (from the previous conversation's message list, which is now cleared).

When `selectConversation()` is called mid-stream:
1. `clearMessages('')` wipes `messagesList.innerHTML` 
2. `streamingBubble` still points to the now-detached DOM node
3. `onStreamChunk` keeps updating the detached node (no-op visually)
4. `finalizeStreamingBubble` runs and shows "Error" on the detached node, not visible

Result: the user sees the typing indicator but never sees the response.

**Fix** — in `selectConversation()` (chat-panel-app.js), clean up streaming state:
```js
function selectConversation(id, title, broadcast) {
  // Clean up any in-progress stream
  if (streamingBubble) {
    streamingBubble = null;
    streamedText = '';
    typingIndicator.classList.add('hidden');
  }
  // ... rest of function
```

### Flake 3: `onShowUserMessage` + `onStreamChunk` can arrive out of order

**File:** `renderer/js/chat-panel-app.js`

The flow is:
1. Main sends `chat:show-user-message` to chatPanel
2. Main starts streaming → sends `chat:stream-chunk` events

But if the IPC event queue has any delay, `onStreamChunk` could arrive before `onShowUserMessage`. The code handles this (`if (!streamingBubble) startStreamingBubble()` in onStreamChunk), but `typingIndicator` is never shown because it's only shown in `onShowUserMessage`. The user sees no visual feedback that a response is coming until the first chunk appears.

**Fix** — show the typing indicator in `onStreamChunk` if we haven't received `onShowUserMessage` yet:
```js
window.dopl.chat.onStreamChunk((chunk) => {
  typingIndicator.classList.add('hidden');
  if (!streamingBubble) {
    startStreamingBubble(); // Creates the bubble
  }
  // ...
});
```
(This is already there. The real fix is to show the typing indicator immediately after `sendMessage()` is called in `input-bar-app.js`, not wait for main to echo back.)

### Flake 4: Conversation list shows stale `updated_at` timestamps

**File:** `renderer/js/chat-panel-app.js`, `onMessageFinalized` handler

When a message is finalized, the code updates `conversations[idx].updated_at` and re-renders. But `relativeTime()` in utils.js returns strings like "just now", "5m ago" — these are frozen at render time and never update.

**Fix** — use a periodic re-render of relative timestamps (e.g., `setInterval` every 60 seconds to call `renderConversationList(conversations)`).

### Flake 5: Token paste mode — error message is transient, gets reset by next init

**File:** `renderer/js/input-bar-app.js`, `handleTokenSubmit()`

On connect failure, the placeholder is set to `'❌ Error message — try again'`. But on the next `init` run (page reload), it's reset to the default placeholder. There's no persistent error display.

More importantly, after a failed token connect, `msgInput.placeholder` shows the error — but if the user starts typing immediately, the error disappears and there's no indication of what went wrong.

### Flake 6: `ensureCLI()` uses blocking `execSync` on main process

**File:** `main/node-manager.js`, `ensureCLI()` method

`execSync('which openclaw', ...)` and `execSync('npm install -g openclaw', ...)` block the Electron main process. During the npm install (which can take 30-60s), the entire app is frozen — no IPC responses, no window updates.

**Fix** — replace with async `exec` using Node's `child_process.exec`:
```js
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async ensureCLI() {
  try {
    await execAsync('which openclaw', { env: this._buildEnv() });
    return;
  } catch (_) {}
  // ... async npm install
}
```

---

## 4. MISSING FEATURES ⚪

### Missing 1: No direct WebSocket from companion to gateway

The companion app has NO real-time channel to the gateway. `node-manager.js` spawns `openclaw node run` as a subprocess, but the companion itself never opens a WebSocket. This means:

- **The agent cannot push messages to the companion** (e.g., "open this URL", "show this status update")
- **Integration status changes are invisible** — no way for the gateway to say "Google connected"
- **The companion cannot report capabilities** to the gateway (e.g., "I have screen capture, file access")
- **No system prompt refresh** when companion connects — the ChatManager uses a hardcoded system prompt with no dynamic context

The `NodeManager` emits `status` events but only from subprocess stdout parsing. There's no WS heartbeat, no ping/pong, no way to detect silent connection drops (where the process is running but the gateway has closed the connection).

**Fix** — Add a WebSocket client in NodeManager (in addition to the subprocess):
```js
const WebSocket = require('ws');
// After spawnNode():
this._connectWebSocket(); // Direct WS for bidirectional messaging
```

### Missing 2: No system prompt with companion context

**File:** `main/chat-manager.js`, `sendMessage()` — lines building `messages`:
```js
{
  role: 'system',
  content: 'You are a helpful AI assistant running as part of Dopl. Be concise...'
}
```

This is a dead hardcoded system prompt. It doesn't mention:
- What integrations are available
- What tools the companion has (screen capture, file access)
- The user's context from the gateway
- Any OpenClaw agent context

The companion should fetch the system prompt from the gateway's `/v1/system` endpoint or include it in the token.

### Missing 3: No capability reporting

When the companion connects, it never tells the gateway what it can do. The gateway cannot trigger browser automation, file access, or screen capture through the companion because no capability handshake is implemented.

### Missing 4: Window position not persisted

**File:** `main/index.js`, `getInputBarPosition()` always returns the center-bottom position. User preferences for window placement are lost on restart.

**Fix:**
```js
function getInputBarPosition(height) {
  const saved = store.get('inputBarPosition');
  if (saved) return saved;
  // ... default center-bottom
}
// On window moved:
inputBarWindow.on('moved', () => {
  store.set('inputBarPosition', inputBarWindow.getBounds());
});
```

### Missing 5: No retry / error recovery UI

- No "Retry" button after failed message send
- No "Reconnect" button in the chat panel (only in the tray)
- No visual indication of WHY connection failed (wrong token, network issue, server down)
- No offline mode / message queue

### Missing 6: No app auto-update mechanism

`package.json` has no `electron-updater` or update configuration. Users will always run the version they installed.

---

## 5. UI/UX ISSUES 🟠

### UX Issue 1: Dead file `index.html` with obsolete JS files

`renderer/index.html` is **never loaded** by any window. The app was refactored to the two-window architecture but the old files remain:
- `renderer/index.html` — old single-window HTML (not loaded)
- `renderer/js/app.js` — old monolithic app logic (not loaded)
- `renderer/js/chat.js` — old chat.js with `sendMessage`, `appendMessage`, etc. (not loaded)
- `renderer/js/conversations.js` — old conversation manager (not loaded)

These files are dead code. They clutter the repo and will confuse future developers.

**Additionally:** `chat.js` references globals from `app.js` (`convSelectorText`, `setInputEnabled`, `autoResizeInput`) that would be available via global scope. `conversations.js` references `messagesList`, `typingIndicator`, `chatTitle` etc. — all from `app.js`. These would work at runtime since they're in the same global scope, but they're never executed.

### UX Issue 2: `preload.js` exposes `windowClose/Minimize/Zoom` that don't exist

**File:** `renderer/js/app.js` (dead code), lines:
```js
document.querySelectorAll('.wc-close').forEach(btn => {
  btn.addEventListener('click', () => window.dopl.windowClose());
});
```

But `preload.js` does NOT expose `window.dopl.windowClose`, `window.dopl.windowMinimize`, or `window.dopl.windowZoom`. Calling these would throw `TypeError: window.dopl.windowClose is not a function`.

This is in dead code (`app.js` for `index.html`), but it means the old setup screen's window controls are broken.

**For reference**: `ipc.js` has handlers for `window-close`, `window-minimize`, `window-zoom` (they're no-ops). The preload just doesn't expose them.

### UX Issue 3: Chat panel doesn't show conversations on first open if token was restored

**File:** `renderer/js/chat-panel-app.js`, initialization IIFE

```js
if (state.token) {
  await loadConversations();
  clearMessages('Start a conversation below');
}
```

This loads conversations on init. But `input-bar-app.js` also calls `window.dopl.chat.sendMessage()` on first message, which triggers `window.dopl.showChatPanel()`. If the chat panel was hidden and is shown AFTER init, the conversations are already loaded — fine.

BUT: if the user's first action is to open the conversation selector and the API call is slow, they see "No conversations yet" momentarily. There's no loading spinner.

### UX Issue 4: Glass tint applies instantly on slider `input` but is only broadcast on `change`

**File:** `renderer/js/input-bar-app.js` (tint slider)

The CSS variable `--glass-tint-opacity` updates on every `input` event (live), which is correct. But the `onGlassTintChanged` broadcast (which updates the chat panel) only fires on `change` (mouse-up). So the chat panel tint lags behind the input bar tint while dragging the slider.

**Fix** — broadcast on `input` too:
```js
tintSlider.addEventListener('input', (e) => {
  applyGlassTint(e.target.value);
  window.dopl.setGlassTint(parseFloat(e.target.value)).catch(() => {}); // broadcast live
});
// Remove the 'change' handler or use it only for persistence
```

### UX Issue 5: The `msg-input` textarea doesn't auto-resize in `input-bar-app.js` on paste

`autoResizeInput()` is called on `input` event. But on paste via keyboard or mouse, the `input` event fires correctly. However, the `windowSetSize` call is not made to expand the input bar window vertically when the textarea grows (the textarea has `max-height: 120px` via CSS, and the window height is fixed at 68px). A multi-line message will overflow the window but the window won't grow.

Actually `INPUT_BAR_HEIGHT = 68` is fixed and never dynamically adjusted in `input-bar-app.js` based on textarea height. The textarea is capped at `max-height: 120px` by CSS, but the window is only 68px.

### UX Issue 6: `settings-dropdown` position when near top of screen

**File:** `renderer/js/input-bar-app.js`, `openSettings()`

```js
window.dopl.windowSetSize(680, dropdownH + DROPDOWN_GAP + INPUT_BAR_HEIGHT, false);
```

This grows the window **upward** (the IPC handler `resizeInputBar` anchors the bottom edge). But if the user has moved the input bar near the top of the screen, the dropdown will be cut off by the top screen edge. There's no bounds checking.

### UX Issue 7: No visual feedback when the connection is "connecting" (transitional state)

`conn-dot` shows either `connected` (green) or `disconnected` (red). There's no "connecting" (yellow/pulsing) state. While `openclaw node run` is starting up (which can take 5-10 seconds), the dot shows red even though it's trying to connect. This is misleading.

**Fix** — Add a `connecting` CSS class that pulses:
```css
.conn-dot.connecting {
  background: #f59e0b;
  animation: pulse 1s infinite;
}
```
And emit a `connecting` status from NodeManager before `spawnNode()`.

### UX Issue 8: Integration card icons use `favicon.ico` from external service domains

**File:** `renderer/js/utils.js`, `renderIntegrationCard()`:
```js
src="https://${escapeHtml(service.toLowerCase())}.com/favicon.ico"
```

This makes network requests to external domains for favicons. The CSP in `chat-panel.html` is:
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self';">
```

`default-src 'self'` blocks all external image requests. These favicon URLs will **all fail** silently (the `onerror="this.style.display='none'"` handles it, so it's not a crash, but it's wasted attempts).

**Fix** — Use bundled SVG icons for common services, or relax CSP to allow specific favicon hosts.

---

## 6. RECOMMENDED FIXES (Prioritized)

### P0 — Fix click-through immediately (blocks all use)

**File: `main/index.js`** — after `inputBarWindow.once('ready-to-show', ...)`:
```js
inputBarWindow.once('ready-to-show', () => {
  inputBarWindow.show();
  inputBarWindow.setIgnoreMouseEvents(true, { forward: true }); // ← ADD
});
```

**File: `main/index.js`** — after `chatPanelWindow.loadFile(...)`:
```js
chatPanelWindow.loadFile(...);
chatPanelWindow.setIgnoreMouseEvents(true, { forward: true }); // ← ADD
```

**File: `main/ipc.js`** — add IPC handler in `setupIPC()`:
```js
const { BrowserWindow } = require('electron'); // add to imports
// ...
ipcMain.on('set-ignore-mouse-events', (event, { ignore }) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win) win.setIgnoreMouseEvents(!!ignore, { forward: true });
});
```

**File: `renderer/preload.js`** — add to contextBridge:
```js
setIgnoreMouseEvents: (ignore) => ipcRenderer.send('set-ignore-mouse-events', { ignore }),
```

**File: `renderer/js/input-bar-app.js`** — add at end of file (before IIFE):
```js
// Pass-through clicks on transparent areas
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overInteractive = !!(el && (
    el.closest('.input-bar-glass') ||
    el.closest('.settings-dropdown') ||
    el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON' || el.tagName === 'INPUT'
  ));
  window.dopl.setIgnoreMouseEvents(!overInteractive);
});
```

**File: `renderer/js/chat-panel-app.js`** — add at end of file (before IIFE):
```js
document.addEventListener('mousemove', (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  const overPanel = !!(el && el.closest('.chat-panel'));
  window.dopl.setIgnoreMouseEvents(!overPanel);
});
```

**File: `renderer/styles/base.css`** — change the drag region rule:
```css
/* BEFORE: */
html, body, .screen, .screen.active {
  -webkit-app-region: drag;
}

/* AFTER: */
html, body, .screen, .screen.active {
  -webkit-app-region: no-drag;
}
```
(Drag is already set on `.input-bar-glass` and `.chat-panel-header` via their own CSS rules — no loss of drag functionality.)

---

### P1 — Single-instance lock

**File: `main/index.js`** — add before `app.whenReady()`:
```js
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }
else {
  app.on('second-instance', () => {
    if (inputBarWindow && !inputBarWindow.isDestroyed()) inputBarWindow.show();
  });
}
```

---

### P2 — Fix `_approvingPending` reset bug

**File: `main/node-manager.js`**, top of `spawnNode()`:
```js
spawnNode() {
  if (!this.shouldRun) return;
  this._approvingPending = false;   // ← ADD
  const { host, port, tls } = this.parseGatewayUrl();
  // ...
```

---

### P3 — Add streaming fetch timeout

**File: `main/chat-manager.js`**, in `sendMessage()`:
```js
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 120_000);

const response = await fetch(`${this.gatewayUrl}/v1/chat/completions`, {
  method: 'POST',
  signal: controller.signal,
  headers: { ... },
  body: JSON.stringify({ ... }),
});

// ... in the stream loop finally block:
} finally {
  clearTimeout(timeoutId);
  reader.releaseLock();
}
```

---

### P4 — Follow input bar with chat panel on move

**File: `main/index.js`**, in `createInputBarWindow()`:
```js
inputBarWindow.on('moved', () => {
  if (chatPanelVisible && chatPanelWindow && !chatPanelWindow.isDestroyed()) {
    positionChatPanel();
  }
});
```

---

### P5 — Add "connecting" status state to NodeManager

**File: `main/node-manager.js`**, in `spawnNode()` before spawning:
```js
// Emit connecting status so UI can show yellow dot
this.lastError = null;
this.emit('status', 'connecting');
// ...spawn...
```

**File: `main/index.js`** and `main/ipc.js`** — update status-update broadcast to pass `'connecting'` state and update renderer CSS class accordingly.

---

### P6 — Clean up dead code

Remove or archive these files that are never loaded:
- `renderer/index.html`
- `renderer/js/app.js`
- `renderer/js/chat.js`
- `renderer/js/conversations.js`

These files are confusing dead code from the old single-window architecture.

---

### P7 — Persist window position

**File: `main/index.js`**:
```js
function getInputBarPosition(height) {
  const saved = store.get('inputBarBounds');
  if (saved) return { x: saved.x, y: saved.y };
  // ... default calculation
}

// In createInputBarWindow(), after show:
inputBarWindow.on('moved', () => {
  store.set('inputBarBounds', inputBarWindow.getBounds());
});
```

---

## Summary Table

| # | Issue | File | Severity | Fix Complexity |
|---|-------|------|----------|----------------|
| 1 | `setIgnoreMouseEvents` never called — clicks blocked everywhere | `main/index.js`, `main/ipc.js`, `preload.js`, both app JS | 🔴 Critical | Medium |
| 2 | `-webkit-app-region: drag` on transparent body | `styles/base.css` | 🔴 Critical | Trivial |
| 3 | `_approvingPending` never reset on reconnect | `main/node-manager.js` | 🔴 Critical | Trivial |
| 4 | No single-instance lock | `main/index.js` | 🔴 Critical | Trivial |
| 5 | Streaming fetch hangs on network drop | `main/chat-manager.js` | 🔴 Critical | Easy |
| 6 | Chat panel doesn't follow moved input bar | `main/index.js` | 🟡 Medium | Trivial |
| 7 | Streaming bubble not cleaned up on conversation switch | `chat-panel-app.js` | 🟡 Medium | Easy |
| 8 | `ensureCLI` blocks main process with execSync | `main/node-manager.js` | 🟡 Medium | Medium |
| 9 | No WebSocket → no push notifications, no integration status | Architecture | 🟡 Medium | Hard |
| 10 | No window position persistence | `main/index.js` | ⚪ Low | Easy |
| 11 | Dead code files polluting renderer | `index.html`, `app.js`, `chat.js`, `conversations.js` | ⚪ Low | Trivial |
| 12 | Integration card favicons blocked by CSP | `utils.js`, `chat-panel.html` | ⚪ Low | Easy |
| 13 | Tint slider doesn't broadcast live to chat panel | `input-bar-app.js` | ⚪ Low | Trivial |
| 14 | No connecting (yellow) state in conn-dot | `node-manager.js`, CSS | ⚪ Low | Easy |

---

*The click-through bug (issues 1 & 2) is the most impactful and must be fixed first. Without `setIgnoreMouseEvents(true, { forward: true })`, the app is fundamentally broken as an overlay — it blocks all interaction with everything beneath it.*
