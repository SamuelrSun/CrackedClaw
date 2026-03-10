const screenSetup = document.getElementById('screen-setup');
const screenConnected = document.getElementById('screen-connected');
const tokenInput = document.getElementById('token-input');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const errorMsg = document.getElementById('error-msg');
const instanceUrl = document.getElementById('instance-url');

function showScreen(name) {
  screenSetup.classList.toggle('active', name === 'setup');
  screenConnected.classList.toggle('active', name === 'connected');
}

function showError(msg) {
  errorMsg.textContent = msg || '';
}

btnConnect.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    showError('Please paste a connection token');
    return;
  }

  btnConnect.disabled = true;
  btnConnect.textContent = 'Connecting...';
  showError('');

  const result = await window.crackedclaw.connect(token);

  if (result.ok) {
    try {
      const decoded = JSON.parse(atob(token));
      instanceUrl.textContent = decoded.gatewayUrl || '';
    } catch (_) {
      instanceUrl.textContent = '';
    }
    showScreen('connected');
  } else {
    showError(result.error || 'Connection failed');
  }

  btnConnect.disabled = false;
  btnConnect.textContent = 'Connect';
});

btnDisconnect.addEventListener('click', async () => {
  await window.crackedclaw.disconnect();
  tokenInput.value = '';
  showScreen('setup');
});

window.crackedclaw.onStatusUpdate((data) => {
  if (data.connected) {
    instanceUrl.textContent = data.gatewayUrl || '';
    showScreen('connected');
  } else if (!data.connected && screenConnected.classList.contains('active')) {
    // Stay on connected screen but could show reconnecting state
    if (data.error) {
      instanceUrl.textContent = `Reconnecting... (${data.error})`;
    }
  }
});

// Initialize
(async () => {
  const state = await window.crackedclaw.getState();
  if (state.connected || state.token) {
    instanceUrl.textContent = state.gatewayUrl || '';
    showScreen('connected');
  } else {
    showScreen('setup');
  }
})();
