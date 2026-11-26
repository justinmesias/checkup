/* CheckUP service worker: keeps the app working offline */
const VERSION = 'checkup-1595e048';
const FILES = ['./', 'index.html', 'engine.js', 'scanworker.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png',
  'libs/jspdf.umd.min.js', 'libs/pdf.min.js', 'libs/pdf.worker.min.js', 'libs/xlsx.full.min.js', 'libs/mammoth.browser.min.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES))); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(ca => ca.put(e.request, c)); } return r; }).catch(() => caches.match('index.html'))));
});
