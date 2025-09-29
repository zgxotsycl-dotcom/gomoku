// public/sw-rocket.js
// 비디오 프리캐시 + Range 요청(부분 요청) 대응
const CACHE = "rocket-v2";
const ASSETS = [
  "/videos/rocket-320.mp4",
  "/videos/rocket-480.mp4",
  "/videos/rocket-720.mp4",
  "/videos/rocket-1080.mp4",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    (async () => {
      const c = await caches.open(CACHE);
      await c.addAll(ASSETS); // 전체 바디 사전 캐시
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
      self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (!ASSETS.some(a => url.pathname.endsWith(a.replace(/^\/+/, "")))) return; // 비디오만 처리

  // Range 헤더가 있는 경우 → 캐시에 전체 바디 있으면 206으로 잘라서 응답
  const range = e.request.headers.get("Range");
  if (range) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const full = await cache.match(url.pathname);
      if (full) {
        const buf = await full.arrayBuffer();
        // ex) "bytes=START-END"
        const m = /bytes=(\d+)-(\d+)?/.exec(range);
        const start = m ? Number(m[1]) : 0;
        const end = m && m[2] ? Number(m[2]) : buf.byteLength - 1;
        const chunk = buf.slice(start, end + 1);
        return new Response(chunk, {
          status: 206,
          statusText: "Partial Content",
          headers: {
            "Content-Type": full.headers.get("Content-Type") || "video/mp4",
            "Content-Range": `bytes ${start}-${end}/${buf.byteLength}`,
            "Accept-Ranges": "bytes",
            "Content-Length": String(chunk.byteLength),
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }
      // 캐시에 없으면 네트워크로 전달(브라우저 HTTP 캐시에 맡김)
      return fetch(e.request);
    })());
    return;
  }

  // Range 아닌 일반 요청 → 캐시 우선, 없으면 네트워크 후 캐시에 저장
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(url.pathname);
    if (hit) return hit;
    const res = await fetch(e.request);
    if (res.ok) cache.put(url.pathname, res.clone());
    return res;
  })());
});
