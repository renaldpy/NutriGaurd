importScripts('env.js');

const ANALYZE_ENDPOINT = `${self.BACKEND_URL}/api/analyze-checkout`;

// Cross-origin fetches from a content script are scoped to the page's own
// origin for CORS purposes and vary per site. Routing through the background
// service worker (privileged, covered by host_permissions) avoids that entirely.
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'ANALYZE_CART') return false;

  fetch(ANALYZE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message.payload)
  })
    .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
    .then(({ ok, data }) => sendResponse({ success: ok, data }))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // keep the message channel open for the async response
});
