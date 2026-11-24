// Partes SITE (versión web / iPhone): funciona sin cobertura y aplica las actualizaciones publicadas desde la app
const CACHE = 'partes-site-v1', OVERRIDE = 'partes-override';
const BASICOS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
function cmp(a, b) {
  const x = String(a || '0').split('.').map(Number), y = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (x[i] || 0) - (y[i] || 0); if (d) return d > 0 ? 1 : -1; }
  return 0;
}
const ver = t => (t.match(/const VERSION = '([0-9.]+)'/) || [])[1];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(BASICOS)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('message', e => {
  const d = e.data || {}, port = e.ports && e.ports[0];
  const fin = v => { if (port) port.postMessage(v); };
  if (d.tipo === 'guardarHtml') {
    e.waitUntil((async () => {
      try {
        if (!d.html || d.html.length < 100000 || ver(d.html) !== d.version) return fin(false);
        const c = await caches.open(OVERRIDE);
        await c.put('override', new Response(d.html, {headers: {'Content-Type': 'text/html; charset=utf-8'}}));
        fin(true);
      } catch (err) { fin(false); }
    })());
  } else if (d.tipo === 'borrarHtml') {
    e.waitUntil(caches.delete(OVERRIDE).then(() => fin(true)));
  }
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  if (r.mode === 'navigate') {
    e.respondWith((async () => {
      let base = null;
      try {   // primero la web (lo último subido); si no hay cobertura, lo guardado
        base = await fetch(r, {cache: 'no-store'});
        if (base.ok) { const c = await caches.open(CACHE); await c.put('./index.html', base.clone()); }
      } catch (err) { base = await caches.match('./index.html') || await caches.match('./'); }
      try {
        const ov = await (await caches.open(OVERRIDE)).match('override');
        if (ov && base) {
          const tb = await base.clone().text(), to = await ov.clone().text();
          if (cmp(ver(to), ver(tb)) > 0) return new Response(to, {headers: {'Content-Type': 'text/html; charset=utf-8'}});
        }
      } catch (err) {}
      return base || new Response('Sin conexión', {status: 503, headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    })());
    return;
  }
  if (new URL(r.url).origin === self.location.origin) {
    e.respondWith(caches.match(r).then(m => m || fetch(r)));
  }
});
