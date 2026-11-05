// 오프라인에서도 열리도록 앱 파일을 보관한다. 늘 네트워크를 먼저 쓰고, 안 되면 보관본을 쓴다.
const CACHE = "lbw-v2";
const FILES = ["./", "index.html", "style.css", "js/core.js", "js/ui.js", "js/study.js", "js/views.js", "js/more.js", "js/main.js",
  "data/kana.js", "data/ja.js", "data/ja_more.js", "data/en.js", "data/en_more.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;  // GitHub·Claude API는 건드리지 않음
  e.respondWith(
    fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, {ignoreSearch: true}))
  );
});
