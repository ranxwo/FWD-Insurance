/* Service Worker — ทำให้เว็บติดตั้งเป็นแอปและเปิดได้แม้สัญญาณไม่ดี
   เมื่อแก้ไฟล์เว็บแล้วอัปขึ้น GitHub ให้เปลี่ยนเลข VERSION ทุกครั้ง เพื่อให้มือถือโหลดเวอร์ชันใหม่ */
const VERSION = "v10";
const CACHE = "team-web-" + VERSION;
const SHELL = ["./", "./index.html", "./app.js", "./manifest.json",
  "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  // ข้อมูลลูกค้าจาก Google Apps Script และคำขอที่ไม่ใช่ GET ไม่เก็บใน cache เด็ดขาด
  if (req.method !== "GET" || url.hostname.includes("script.google") || url.hostname.includes("googleusercontent")) return;
  // ไฟล์ของเว็บ: ลองโหลดใหม่ก่อน ถ้าออฟไลน์ใช้ของที่เก็บไว้
  if (url.origin === location.origin) {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
    return;
  }
  // ฟอนต์ Google: ใช้ cache ก่อน
  if (url.hostname.includes("fonts.g")) {
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res;
    })));
  }
});
