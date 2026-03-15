# Dopl Connect — Installation & First-Launch Audit

**Audit Date:** 2026-03-15  
**Target User:** Non-technical macOS user who has never used a terminal  
**Scope:** Full workflow from DMG download to first message sent

---

## 1. STEP-BY-STEP WALKTHROUGH

### Step 1: Download DMG
User clicks download link in web app → receives `Dopl Connect.dmg`

### Step 2: Install App
1. User opens DMG
2. Sees standard macOS drag-to-Applications layout (configured in package.json)
3. Drags app to Applications folder
4. Ejects DMG

### Step 3: First Launch
1. User double-clicks "Dopl Connect" in Applications
2. **macOS Gatekeeper Warning**: "Dopl Connect" cannot be opened because it is from an unidentified developer
   - App is ad-hoc signed (not notarized)
   - User must right-click → Open → click "Open" in dialog
3. App starts, input bar appears at bottom of screen

### Step 4: Runtime Download (HIDDEN FROM USER — PROBLEM)
1. `RuntimeManager.ensure()` runs immediately on app ready
2. Downloads Node.js 22 (~40MB) to `~/Library/Application Support/dopl-connect/runtime/`
3. Installs `openclaw` npm package
4. **User sees:** Input bar with disabled state and placeholder text showing progress
5. Takes 1-2 minutes on decent connection

### Step 5: Permission Prompts
1. After 2 second delay, app triggers:
   - `systemPreferences.isTrustedAccessibilityClient(true)` → Shows Accessibility prompt
   - `desktopCapturer.getSources()` → Should trigger Screen Recording prompt
2. User sees macOS permission dialogs

### Step 6: Token Paste
1. Input bar shows: "🔗 Paste connection token to link your instance…"
2. User pastes base64 token from web app
3. Presses Enter or clicks send button
4. Token is decoded, validated, stored

### Step 7: Connection
1. `NodeManager.start()` spawns `openclaw node run` process
2. Process connects to gateway via WebSocket
3. On "pairing required" error → auto-approve API call
4. Connection status dot turns green

### Step 8: Chat
1. User can type messages
2. Auto-creates conversation on first message
3. Chat panel opens automatically
4. Messages stream in real-time

---

## 2. BLOCKERS — Will Definitely Prevent Non-Technical Users From Succeeding

### 🚨 BLOCKER 1: Gatekeeper "Unidentified Developer" Warning
**File:** `package.json` lines 18-21, `scripts/sign.js`

**Problem:** App is ad-hoc signed (`identity: null`), not notarized. macOS will show:
- "Dopl Connect can't be opened because Apple cannot check it for malicious software"
- User must know to right-click → Open → click "Open" again

**Impact:** Most non-technical users will think the app is broken or malware. They won't know the right-click workaround.

**Fix Required:**
1. Get Apple Developer ID certificate ($99/year)
2. Sign with `codesign --sign "Developer ID Application: Your Name"`
3. Notarize with `xcrun notarytool submit`
4. Staple ticket with `xcrun stapler staple`

---

### 🚨 BLOCKER 2: No Visual Feedback During Runtime Download
**File:** `main/runtime-manager.js`, `renderer/js/input-bar-app.js` lines 247-270

**Problem:** The runtime download (Node.js + openclaw) happens silently in the background. The input bar placeholder shows:
- "⬇️ Downloading runtime… (first time only, ~40MB)"
- "⚙️ Installing components… (almost there)"

But there's **NO progress bar, NO percentage, NO estimated time**. On a slow connection, the user stares at this for 5+ minutes with no indication it's actually working.

**Impact:** Users will think the app is frozen and force-quit it.

**Fix Required:**
```javascript
// runtime-manager.js - Add download progress tracking
_download(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const totalBytes = parseInt(response.headers['content-length'], 10);
      let downloadedBytes = 0;
      
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (onProgress && totalBytes) {
          onProgress(downloadedBytes / totalBytes);
        }
      });
      // ... rest of download logic
    });
  });
}
```

Then update input-bar-app.js to show: "⬇️ Downloading runtime… 45% (18MB / 40MB)"

---

### 🚨 BLOCKER 3: Runtime Download Failure Has No Retry UI
**File:** `main/runtime-manager.js` lines 53-80, `renderer/js/input-bar-app.js` lines 265-268

**Problem:** If the download fails (network error, firewall, corporate proxy), the app shows:
```
❌ Setup failed: [error message] — restart to retry
```

The user must **quit and relaunch the app** to retry. There's no "Retry" button.

**Impact:** Non-technical users won't know what "restart to retry" means. They'll be stuck.

**Fix Required:**
1. Add a retry button to the input bar UI
2. Add IPC handler: `ipcMain.handle('runtime-retry', () => runtimeManager.ensure())`
3. Show the button when status is 'error'

---

### 🚨 BLOCKER 4: Interrupted Download Leaves Broken State
**File:** `main/runtime-manager.js` lines 97-115

**Problem:** If the user quits the app mid-download:
- Node.js tar.gz may be partially downloaded
- Extraction may be incomplete
- On next launch, `isReady()` returns false, but the partial files exist

The code DOES attempt to clean up (`fs.rmSync(NODE_DIR, { recursive: true })`), but:
1. The cleanup happens AFTER checking `nodeFunctional`, which fails
2. If the `.tar.gz` file is corrupted, extraction will fail repeatedly

**Current mitigation (partial):** Lines 94-96 do remove stale tar files, but not corrupted extracted directories.

**Fix Required:** Add explicit cleanup before each step:
```javascript
// Before downloading, ensure clean state
if (fs.existsSync(tarPath)) fs.unlinkSync(tarPath);
if (fs.existsSync(NODE_DIR)) fs.rmSync(NODE_DIR, { recursive: true, force: true });
```

---

### 🚨 BLOCKER 5: Token Paste — No Guidance on WHERE to Get Token
**File:** `renderer/js/input-bar-app.js` lines 56-67

**Problem:** Input bar shows "🔗 Paste connection token to link your instance…" but:
- No link to the web app
- No explanation of what a "connection token" is
- No visual diagram or help text

**Impact:** User downloaded the app but doesn't know where to get the token.

**Fix Required:** Add a help link or tooltip:
```html
<div class="token-help">
  Get your token from 
  <a href="#" onclick="window.dopl.openInBrowser('https://usedopl.com/settings/companion')">
    usedopl.com/settings
  </a>
</div>
```

---

## 3. CONFUSING — Things That Will Confuse Users Even If They Technically Work

### ⚠️ CONFUSING 1: Permission Prompts Appear Without Context
**File:** `main/index.js` lines 247-268

**Problem:** After 2 seconds, macOS permission dialogs appear asking for:
- Accessibility access
- Screen Recording access

But there's **no in-app UI explaining WHY** these are needed or what features require them.

**Impact:** Users may deny permissions without understanding the consequences.

**Fix Required:** Show a pre-permission screen explaining:
```
"Dopl Connect needs these permissions to:
✓ Accessibility — Control apps and automate tasks
✓ Screen Recording — Share your screen with your AI

You'll see macOS prompts next. Click 'Open System Preferences' to grant access."
```

---

### ⚠️ CONFUSING 2: Permission Denial Has No Recovery Path
**File:** `main/ipc.js` lines 19-31

**Problem:** IPC handlers exist for `open-accessibility-settings` and `open-screen-recording-settings`, but they're **never called from the UI**. If user denies permissions, there's no UI to:
1. Tell them what's broken
2. Guide them to re-enable

**Impact:** App may silently fail certain features with no explanation.

**Fix Required:** Add a permissions status indicator and settings links to the settings dropdown.

---

### ⚠️ CONFUSING 3: "Connecting" Yellow Dot vs "Disconnected" Red Dot
**File:** `renderer/styles/controls.css` lines 1-20

**Problem:** The connection status dot has three states:
- 🔴 Red = Disconnected
- 🟡 Yellow (pulsing) = Connecting
- 🟢 Green = Connected

But there's no legend or tooltip explaining these states. The yellow "connecting" state can last 30+ seconds during auto-approval flow, and users won't know if it's stuck.

**Fix Required:** Add a tooltip or status text below the dot showing current state and any error message.

---

### ⚠️ CONFUSING 4: Token Validation Errors Are Cryptic
**File:** `renderer/js/input-bar-app.js` lines 138-145

**Problem:** When token paste fails, error is shown as:
```
❌ [error message truncated to 70 chars] — paste token again to retry
```

But common errors like:
- "Invalid token: missing required fields" 
- "HTTP 401: Unauthorized"
- "ECONNREFUSED"

...mean nothing to non-technical users.

**Fix Required:** Map errors to human-readable messages:
```javascript
const errorMessages = {
  'Invalid token': 'This token appears to be incomplete. Copy the full token from the web app.',
  'missing required fields': 'Token is corrupted. Please copy a fresh token.',
  '401': 'Token has expired. Generate a new one from the web app.',
  'ECONNREFUSED': 'Cannot reach server. Check your internet connection.',
};
```

---

### ⚠️ CONFUSING 5: Chat Panel Opens Automatically But Input Bar Stays Focused
**File:** `renderer/js/input-bar-app.js` lines 192-194

**Problem:** When user sends first message, `showChatPanel()` is called automatically. But:
- Chat panel appears ABOVE the input bar
- User's focus stays on input bar
- They might not notice the chat panel opened

**Impact:** User may think message didn't send.

**Fix Required:** Add a subtle animation or sound when chat panel opens. Consider making the panel slide up instead of just appearing.

---

### ⚠️ CONFUSING 6: "New Chat" Creates Conversation Only On First Message
**File:** `renderer/js/input-bar-app.js` lines 165-184

**Problem:** When user clicks "New Chat" in the dropdown:
- Title shows "New Chat"
- `currentConversationId` is set to `null`
- Conversation is only created when first message is sent

This is actually GOOD UX, but the user doesn't know if they're in a new conversation or if something is broken.

**Fix Required:** Add a visual indicator like "Type your first message to start this chat."

---

## 4. MISSING — Things That Should Exist But Don't

### ❌ MISSING 1: Onboarding / Welcome Flow
There's no first-run experience. User opens the app and sees... a text input. They need:
1. Welcome message
2. "Here's how to connect" guide
3. Permission setup wizard
4. "You're all set!" confirmation

---

### ❌ MISSING 2: Error Logging / Diagnostics
**File:** All main process files

**Problem:** Errors go to `console.log`/`console.error` but there's no:
- Log file the user can share with support
- "Copy diagnostics" button
- Crash reporting

**Impact:** When things break, there's no way for users to get help.

**Fix Required:** Add electron-log or similar:
```javascript
const log = require('electron-log');
log.transports.file.level = 'info';
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
```

---

### ❌ MISSING 3: Offline / Network Error Handling
**File:** `main/node-manager.js`, `main/chat-manager.js`

**Problem:** No explicit handling for:
- Offline state (airplane mode)
- Network drops mid-conversation
- Gateway downtime
- Firewall blocking WebSocket

The reconnect loop in `NodeManager` (line 153) waits 5 seconds between attempts, but the user sees nothing.

**Fix Required:** Add network state detection and clear UI messaging:
```javascript
const { net } = require('electron');
if (!net.isOnline()) {
  this._emit('offline', 'No internet connection');
}
```

---

### ❌ MISSING 4: App Update Mechanism
**File:** `package.json`

**Problem:** No auto-update or update notification system. When you ship fixes, users will be stuck on old versions forever.

**Fix Required:** Add electron-updater:
```json
"dependencies": {
  "electron-updater": "^6.1.7"
}
```

---

### ❌ MISSING 5: Tray Icon Tooltip Doesn't Show Connection Status
**File:** `main/index.js` lines 139-141

**Problem:** Tray tooltip is always "Dopl Connect" regardless of connection state. Should show "Connected to [instance name]" or "Disconnected".

---

### ❌ MISSING 6: Keyboard Shortcuts
No keyboard shortcuts for:
- Toggle input bar visibility (global hotkey)
- Toggle chat panel (Cmd+Shift+C?)
- Send message (Enter works, but Cmd+Enter would be nice too)
- New conversation (Cmd+N)

---

### ❌ MISSING 7: Sleep/Wake Handling
**File:** `main/index.js`, `main/node-manager.js`

**Problem:** No handling for:
- `powerMonitor.on('suspend')` — pause reconnection
- `powerMonitor.on('resume')` — force reconnect immediately

When laptop wakes from sleep, the WebSocket may be dead but the app doesn't know for 5+ seconds.

---

### ❌ MISSING 8: Multiple Instance Token Handling
**File:** `main/ipc.js` lines 118-155

**Problem:** If user pastes a new token while already connected:
- Old connection is replaced
- But there's no confirmation dialog
- User might accidentally overwrite their setup

**Fix Required:** Add confirmation: "You're already connected to Instance A. Replace with Instance B?"

---

## 5. GOOD — Things That Are Properly Handled

### ✅ GOOD 1: Single Instance Lock
**File:** `main/index.js` lines 200-208

The app correctly uses `app.requestSingleInstanceLock()` to prevent multiple instances. If user tries to open again, it shows the existing window instead.

---

### ✅ GOOD 2: Token Persistence
**File:** `main/index.js` lines 285-302, `main/ipc.js` lines 118-155

Token is stored via electron-store and automatically reconnects on app restart. Good UX.

---

### ✅ GOOD 3: Auto-Reconnect Loop
**File:** `main/node-manager.js` lines 149-156

When connection drops, it automatically retries every 5 seconds. The reconnect is robust.

---

### ✅ GOOD 4: Streaming Message Rendering
**File:** `renderer/js/chat-panel-app.js` lines 65-90

Messages stream in character-by-character with a nice blinking cursor. The markdown rendering is smooth.

---

### ✅ GOOD 5: Glass Effect / Visual Design
**File:** All CSS files

The transparent/blur glass effect is well-implemented with:
- GPU compositing (`translateZ(0)`, `isolation: isolate`)
- Proper backdrop-filter
- Consistent design tokens
- Dark theme that works well

---

### ✅ GOOD 6: Click-Through Transparent Areas
**File:** `main/index.js` lines 65-67, `renderer/js/input-bar-app.js` lines 227-235

The transparent window areas correctly pass through mouse events using `setIgnoreMouseEvents(true, { forward: true })`. User can click through the app to underlying windows.

---

### ✅ GOOD 7: Position Persistence
**File:** `main/index.js` lines 81-86

Input bar position is saved via electron-store and restored on restart. Good polish.

---

### ✅ GOOD 8: Runtime Cleanup On Retry
**File:** `main/runtime-manager.js` lines 89-96, 107-111

Before downloading Node.js or installing openclaw, the code removes any broken/partial previous attempts. This is correct.

---

### ✅ GOOD 9: Conversation Auto-Creation
**File:** `renderer/js/input-bar-app.js` lines 165-184

User doesn't need to manually create a conversation. Just type and send — conversation is created automatically with the first message as the title.

---

### ✅ GOOD 10: DMG Layout
**File:** `package.json` lines 24-35

The DMG is configured with proper layout (app on left, Applications alias on right) for standard drag-to-install UX.

---

## 6. SPECIFIC FIXES — Exact Code Changes Needed

### Fix 1: Add Progress Bar to Runtime Download
**File:** `main/runtime-manager.js`

```javascript
// Line 129-155: Replace _download method
_download(url, destPath, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    let resolved = false;
    let totalBytes = 0;
    let downloadedBytes = 0;

    const cleanup = (err) => {
      if (resolved) return;
      resolved = true;
      file.close();
      try { fs.unlinkSync(destPath); } catch {}
      reject(err);
    };

    const request = (targetUrl) => {
      https.get(targetUrl, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          const location = response.headers.location;
          if (!location) { cleanup(new Error('Redirect without location header')); return; }
          request(location);
          return;
        }
        if (response.statusCode !== 200) {
          cleanup(new Error(`Download failed: HTTP ${response.statusCode}`));
          return;
        }
        
        totalBytes = parseInt(response.headers['content-length'], 10) || 0;
        
        response.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (onProgress && totalBytes > 0) {
            onProgress(downloadedBytes, totalBytes);
          }
        });
        
        response.pipe(file);
        file.on('finish', () => {
          if (resolved) return;
          resolved = true;
          file.close(resolve);
        });
        response.on('error', cleanup);
      }).on('error', cleanup);
    };

    file.on('error', cleanup);
    request(url);
  });
}

// Line 96: Update _downloadNode to use progress callback
async _downloadNode() {
  // ... existing setup code ...
  
  await this._download(url, tarPath, (downloaded, total) => {
    const pct = Math.round((downloaded / total) * 100);
    const mb = (downloaded / 1024 / 1024).toFixed(1);
    const totalMb = (total / 1024 / 1024).toFixed(1);
    this._emit('downloading-node', `Downloading Node.js... ${pct}% (${mb}/${totalMb} MB)`);
  });
  
  // ... rest of method ...
}
```

**File:** `renderer/js/input-bar-app.js`

```javascript
// Line 252: Update applyRuntimeStatus to handle detailed progress
function applyRuntimeStatus(status, detail, isConnected) {
  if (status === 'downloading-node') {
    // detail now contains progress info like "Downloading Node.js... 45% (18/40 MB)"
    msgInput.placeholder = `⬇️ ${detail || 'Downloading runtime... (first time only)'}`;
    msgInput.disabled = true;
    btnSend.disabled = true;
  }
  // ... rest unchanged
}
```

---

### Fix 2: Add Retry Button for Failed Runtime Setup
**File:** `renderer/input-bar.html`

```html
<!-- Add after line 47 (after settings-dropdown div) -->
<div id="runtime-error-card" class="runtime-error-card hidden">
  <div class="runtime-error-message">
    <span id="runtime-error-text">Setup failed</span>
  </div>
  <button id="btn-retry-setup" class="btn-retry">Retry Setup</button>
</div>
```

**File:** `main/ipc.js`

```javascript
// Add after line 31
ipcMain.handle('runtime-retry', async () => {
  const runtimeManager = getRuntimeManager();
  try {
    await runtimeManager.ensure();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
```

**File:** `renderer/preload.js`

```javascript
// Add to runtime object (around line 51)
runtime: {
  status: () => ipcRenderer.invoke('runtime-status'),
  retry: () => ipcRenderer.invoke('runtime-retry'),
  onStatus: (callback) => {
    ipcRenderer.on('runtime-status-update', (_event, data) => callback(data.status, data.detail));
  },
},
```

---

### Fix 3: Add Pre-Permission Explanation
**File:** `main/index.js`

```javascript
// Replace lines 247-268 with:
function triggerPermissionPrompts() {
  const { systemPreferences, dialog } = require('electron');
  
  // Show explanation dialog FIRST
  dialog.showMessageBox({
    type: 'info',
    title: 'Permissions Required',
    message: 'Dopl Connect needs your permission',
    detail: 'To control apps and automate tasks, Dopl needs:\n\n' +
            '• Accessibility — Let Dopl interact with other apps\n' +
            '• Screen Recording — Let Dopl see your screen\n\n' +
            'Click OK, then grant access in the system prompts that appear.',
    buttons: ['OK'],
  }).then(() => {
    // Now trigger the actual prompts
    systemPreferences.isTrustedAccessibilityClient(true);
    
    const { desktopCapturer } = require('electron');
    desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 1, height: 1 } })
      .catch(() => {});
  });
}
```

---

### Fix 4: Add Human-Readable Error Messages
**File:** `renderer/js/input-bar-app.js`

```javascript
// Add after line 25 (after state declarations)
const ERROR_MESSAGES = {
  'Invalid token': 'Token appears incomplete. Copy the full token from usedopl.com.',
  'missing required fields': 'Token is corrupted. Generate a new token.',
  'JSON': 'Invalid token format. Make sure you copied the entire token.',
  '401': 'Token expired or revoked. Generate a new token.',
  '403': 'Access denied. Check your account permissions.',
  'ECONNREFUSED': 'Cannot reach server. Check your internet connection.',
  'ETIMEDOUT': 'Connection timed out. Check your network.',
  'ENOTFOUND': 'Server not found. Check your internet connection.',
  'network': 'Network error. Check your connection and try again.',
};

function humanizeError(errorMsg) {
  for (const [key, message] of Object.entries(ERROR_MESSAGES)) {
    if (errorMsg.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }
  // Fallback: clean up the raw error
  return errorMsg.split('\n')[0].replace(/^Error:\s*/, '').slice(0, 80);
}

// Then on line 143, replace:
// const shortErr = errMsg.length > 70 ? errMsg.slice(0, 70) + '…' : errMsg;
// With:
const shortErr = humanizeError(result.error || 'Connection failed');
```

---

### Fix 5: Add Help Link for Token
**File:** `renderer/input-bar.html`

```html
<!-- Add inside .input-bar-glass, after the textarea (around line 77) -->
<a id="token-help-link" class="token-help-link hidden" 
   title="Get your connection token">
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.3"/>
    <path d="M7 10V7M7 5V4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
</a>
```

**File:** `renderer/js/input-bar-app.js`

```javascript
// Add to enterTokenMode() function (around line 60)
function enterTokenMode() {
  tokenMode = true;
  // ... existing code ...
  
  // Show help link
  const helpLink = document.getElementById('token-help-link');
  if (helpLink) {
    helpLink.classList.remove('hidden');
    helpLink.onclick = (e) => {
      e.preventDefault();
      window.dopl.openInBrowser('https://usedopl.com/settings/companion');
    };
  }
}

// Add to exitTokenMode() function
function exitTokenMode() {
  // ... existing code ...
  
  // Hide help link
  const helpLink = document.getElementById('token-help-link');
  if (helpLink) helpLink.classList.add('hidden');
}
```

---

### Fix 6: Add Sleep/Wake Handling
**File:** `main/index.js`

```javascript
// Add after line 208 (after single instance lock handling)
const { powerMonitor } = require('electron');

app.whenReady().then(() => {
  // ... existing code ...
  
  // Handle sleep/wake for connection stability
  powerMonitor.on('suspend', () => {
    console.log('[Power] System suspending — pausing reconnection');
    if (nodeManager) {
      nodeManager.pauseReconnect = true;
    }
  });
  
  powerMonitor.on('resume', () => {
    console.log('[Power] System resumed — forcing reconnect');
    if (nodeManager) {
      nodeManager.pauseReconnect = false;
      // Force reconnect by killing and restarting
      if (nodeManager.process) {
        nodeManager.process.kill();
      }
    }
  });
});
```

**File:** `main/node-manager.js`

```javascript
// Add to constructor (around line 24)
this.pauseReconnect = false;

// Modify scheduleReconnect (around line 153)
const scheduleReconnect = (reason) => {
  if (reconnectScheduled || !this.shouldRun) return;
  if (this.pauseReconnect) {
    console.log('[NodeManager] Reconnect paused (system suspended)');
    return;
  }
  // ... rest unchanged
};
```

---

## Summary

| Category | Count |
|----------|-------|
| **BLOCKERS** | 5 |
| **CONFUSING** | 6 |
| **MISSING** | 8 |
| **GOOD** | 10 |

### Priority Order for Fixes:

1. **CRITICAL: Code signing & notarization** — Without this, most users can't even launch the app
2. **CRITICAL: Runtime download progress** — Users will force-quit thinking app is frozen
3. **HIGH: Pre-permission explanation** — Users will deny permissions without understanding
4. **HIGH: Token help link** — Users won't know where to get the token
5. **HIGH: Human-readable errors** — Cryptic errors cause support burden
6. **MEDIUM: Retry button for failed setup** — Reduces friction for edge cases
7. **MEDIUM: Sleep/wake handling** — Improves reliability
8. **LOW: Everything else** — Polish items

The app's core functionality is solid. The glass UI is beautiful. The chat streaming works well. But the first-launch experience has critical gaps that will stop non-technical users cold.
