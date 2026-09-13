// Single source of truth for the backend origin across the service worker and
// content scripts (they run in separate execution contexts and can't share an
// ES import, so this is loaded via importScripts/manifest ordering instead).
self.BACKEND_URL = 'http://localhost:4000';
