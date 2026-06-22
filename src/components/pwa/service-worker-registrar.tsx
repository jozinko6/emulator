"use client";

import { useEffect, useState } from "react";

/**
 * Registers the service worker for PWA offline shell.
 * Skips aggressive activation during gameplay (per prompt section 22).
 */
export function ServiceWorkerRegistrar() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    let reg: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((r) => {
        reg = r;
        if (r.waiting) setUpdateAvailable(true);
        r.addEventListener("updatefound", () => {
          const newWorker = r.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch(() => {
        // SW registration failed — not fatal in sandbox/preview
      });

    return () => {
      reg = null;
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
      <p className="text-sm font-medium">Dostupná aktualizácia</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Nová verzia RETROCLOUD je pripravená. Aktualizovať po ukončení hry.
      </p>
      <button
        className="mt-3 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
        onClick={() => {
          if (typeof navigator === "undefined") return;
          navigator.serviceWorker.getRegistration().then((r) => {
            if (r?.waiting) r.waiting.postMessage({ type: "SKIP_WAITING" });
            window.location.reload();
          });
        }}
      >
        Aktualizovať teraz
      </button>
    </div>
  );
}
