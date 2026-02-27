/**
 * Popup script for Marketrix Widget Chrome Extension
 */

const scriptSrcInput = document.getElementById('scriptSrc');
const agentIdInput = document.getElementById('agentId');
const connectionIdInput = document.getElementById('connectionId');
const enableToggle = document.getElementById('enableToggle');
const saveBtn = document.getElementById('saveBtn');
const statusDiv = document.getElementById('status');

// Load saved configuration
chrome.storage.local.get(['enabled', 'config'], result => {
  if (result.config) {
    scriptSrcInput.value = result.config.scriptSrc || '';
    agentIdInput.value = result.config.agentId || '';
    connectionIdInput.value = result.config.connectionId || '';
  } else {
    // Default values
    scriptSrcInput.value = 'http://localhost:5174/index.mjs';
    agentIdInput.value = '10';
    connectionIdInput.value = '13';
  }

  enableToggle.checked = result.enabled || false;
  updateStatus(result.enabled || false);
});

// Save configuration
saveBtn.addEventListener('click', () => {
  const config = {
    scriptSrc: scriptSrcInput.value.trim(),
    agentId: agentIdInput.value.trim(),
    connectionId: connectionIdInput.value.trim(),
  };

  chrome.storage.local.set({ config }, () => {
    saveBtn.textContent = 'Saved!';
    setTimeout(() => {
      saveBtn.textContent = 'Save Configuration';
    }, 1500);
  });
});

// Toggle enable/disable
enableToggle.addEventListener('change', () => {
  const enabled = enableToggle.checked;
  const config = {
    scriptSrc: scriptSrcInput.value.trim(),
    agentId: agentIdInput.value.trim(),
    connectionId: connectionIdInput.value.trim(),
  };

  chrome.storage.local.set({ enabled, config }, () => {
    updateStatus(enabled);

    // Send message to current tab (fire-and-forget; port may close if popup closes before response)
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: enabled ? 'inject' : 'remove', config }).catch(() => {
          if (enabled) chrome.tabs.reload(tabs[0].id);
        });
      }
    });
  });
});

function updateStatus(enabled) {
  if (enabled) {
    statusDiv.textContent = 'Widget is active on all pages';
    statusDiv.className = 'status active';
  } else {
    statusDiv.textContent = 'Widget is disabled';
    statusDiv.className = 'status';
  }
}
