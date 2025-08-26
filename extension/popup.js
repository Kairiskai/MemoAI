console.log('popup.js loaded');

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function pingContent(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
    return !!(res && res.ok);
  } catch (_) {
    return false;
  }
}

async function ensureInjected(tabId) {
  if (await pingContent(tabId)) return true;

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['config.js', 'index.js']
  });

  return await pingContent(tabId);
}

async function sharePublic() {
  try {
    const tab = await getActiveTab();
    if (!tab || !tab.id) {
      alert('No active tab found');
      return;
    }

    // 只在 Claude 页面上运行（不想限制可以删掉下面两行判断）
    if (!/^https:\/\/claude\.ai\//.test(tab.url || '')) {
      alert('Please open a Claude conversation page first.');
      return;
    }

    const ok = await ensureInjected(tab.id);
    if (!ok) {
      alert('Failed to inject script. Check manifest permissions.');
      return;
    }

    await chrome.tabs.sendMessage(tab.id, { action: 'model', model: 'Claude' });
    await chrome.tabs.sendMessage(tab.id, { action: 'scrape' });
  } catch (err) {
    console.error('sharePublic error:', err);
    alert('share failed: ' + (err?.message || String(err)));
  }
}

function initApp() {
  document.getElementById('sharePublic').addEventListener('click', async () => {
    const btn = document.querySelector('#sharePublic');
    const loader = document.querySelector('#sharePublicLoader');
    btn.style.display = 'none';
    loader.style.display = 'flex';

    await sharePublic();

    setTimeout(() => {
      loader.style.display = 'none';
      btn.style.display = 'flex';
    }, 1500);
  });
}

window.onload = initApp;
