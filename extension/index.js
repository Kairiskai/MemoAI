(() => {
  console.log('[TechX] content script loaded on', location.href);

  let CURRENT_MODEL = 'ChatGPT';

  function getBaseUrl() {
    const cfg = window.EXTENSION_CONFIG || {};
    return cfg.baseUrl || '';
  }

  async function doScrape() {
    try {
      const baseUrl = getBaseUrl();
      if (!baseUrl) throw new Error('baseUrl is empty (check config.js)');

      const html = document.documentElement.outerHTML;

      const fd = new FormData();
      fd.append('htmlDoc', new Blob([html], { type: 'text/html' }), 'conversation.html');
      fd.append('model', CURRENT_MODEL);

      console.log('[TechX] POST', baseUrl + '/api/conversation');
      const resp = await fetch(baseUrl + '/api/conversation', { method: 'POST', body: fd });

      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();

      if (data?.url) {
        window.open(data.url, '_blank');
      } else {
        alert('Saved but no URL returned.');
      }
    } catch (err) {
      console.error('[TechX] scrape failed', err);
      alert('Error saving conversation: ' + err.message);
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    console.log('[TechX] onMessage', msg);

    if (msg.action === 'ping') {
      sendResponse({ ok: true });
      return true;
    }

    if (msg.action === 'model') {
      CURRENT_MODEL = msg.model;
      sendResponse({ ok: true });
      return true;
    }

    if (msg.action === 'scrape') {
      doScrape();
      sendResponse({ ok: true });
      return true;
    }
  });
})();
