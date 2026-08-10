chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "WATCHLIST_SCRAPED") {
    chrome.storage.local.set({ films: message.films }, () => {
      console.log(`[SpinBoxd] Saved ${message.films.length} films.`);
      sendResponse({ ok: true });
    });
    return true;
  }
});
