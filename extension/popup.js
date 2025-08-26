console.log('popup.js is loaded');

function initApp() {
  document.getElementById('sharePublic').addEventListener('click', sharePublic);
}

function sharePublic() {
  console.log('sharePublic function called');
  document.querySelector('#sharePublicLoader').style.display = 'flex';
  document.querySelector('#sharePublic').style.display = 'none';

  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (tabs.length > 0) {
      // 先注入 config.js + index.js
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        files: ['config.js', 'index.js']
      }, () => {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'scrape' }, function (_) {
          console.log('scrape triggered');
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError.message);
          }
        });
      });
    }
  });

  setTimeout(() => {
    document.querySelector('#sharePublicLoader').style.display = 'none';
    document.querySelector('#sharePublic').style.display = 'flex';
  }, 10000);
}

window.onload = initApp;
