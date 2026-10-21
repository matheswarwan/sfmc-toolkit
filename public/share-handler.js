// SFMC Query Saver — share page content script
// Runs on https://sfmc-share-worker.mathes-btech.workers.dev/share/* pages.
// Reads query data embedded by the Worker, imports it via the background service worker,
// and updates the status bar on the page.

(function () {
  const meta = document.getElementById('sfmc-qs-meta');
  if (!meta) return;

  const name = meta.dataset.name;
  const queryText = meta.dataset.queryText;
  if (!queryText) return;

  const timeStamp = Date.now();
  const assetData = {};
  assetData['sql_' + timeStamp] = {
    id: 'sql_' + timeStamp,
    queryText,
    timeStamp,
    url: window.location.href,
    name: name || new Date(timeStamp).toDateString() + ' ' + new Date(timeStamp).toLocaleTimeString(),
    isFavourite: false,
  };

  chrome.runtime.sendMessage(
    { type: 'IMPORT_SHARED_QUERY', records: assetData },
    () => {
      if (chrome.runtime.lastError) return; // extension not available
      window.__sfmcImported = true;
      updateStatusBar(true);
    }
  );

  function updateStatusBar(success) {
    const bar = document.getElementById('sfmc-status');
    const text = document.getElementById('sfmc-status-text');
    if (!bar || !text) return;

    if (success) {
      bar.className = 'status-bar imported';
      text.textContent = 'Query imported into Marketing Cloud Toolkit.';
    } else {
      bar.className = 'status-bar no-ext';
      text.textContent = 'Could not import. Make sure the Marketing Cloud Toolkit extension is installed.';
    }
  }
})();
