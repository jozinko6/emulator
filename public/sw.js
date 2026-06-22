// RETROCLOUD Service Worker
// Caches only the app shell — never ROM/ISO/BIOS/save-state API responses.
const CACHE_NAME = "retrocloud-shell-v1";
const OFFLINE_URL = "/offline/offline.html";

const APP_SHELL = [
  "/",
  "/library",
  "/import",
  "/saves",
  "/settings",
  "/diagnostics",
  "/legal",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  OFFLINE_URL,
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Network-first for navigation, cache-first for static assets,
// NEVER cache /api/*, BIOS, ROM, ISO, BIN, CHD, CSO, PBP, ELF, JSDOS
const NEVER_CACHE_PATTERNS = [
  /^\/api\//,
  /\.(iso|bin|cue|chd|cso|pbp|elf|jsdos|exe|com|bat)$/i,
  /\/bios\//i,
  /\/opfs\//i,
];

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (NEVER_CACHE_PATTERNS.some((p) => p.test(url.pathname))) return;

  // Navigation requests → network-first, fallback to offline
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(req).then((r) => r ?? caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Static assets (same-origin) → cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ??
          fetch(req)
            .then((resp) => {
              if (resp.ok && resp.type === "basic") {
                const copy = resp.clone();
                caches.open(CACHE_NAME).then((c) => c.put(req, copy)).catch(() => {});
              }
              return resp;
            })
            .catch(() => cached)
      )
    );
  }
});
