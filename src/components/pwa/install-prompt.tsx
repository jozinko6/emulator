"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferred || dismissed) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 right-4 md:left-auto md:right-4 z-50 max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <Download className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium">NainĹˇtalovaĹĄ Jaňo še chce bavkac</p>
          <p className="mt-1 text-xs text-muted-foreground">
            NainĹˇtalujte aplikĂˇciu do zariadenia pre rĂ˝chly prĂ­stup a offline reĹľim.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
              onClick={async () => {
                await deferred.prompt();
                await deferred.userChoice;
                setDeferred(null);
              }}
            >
              InĹˇtalovaĹĄ
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs"
              onClick={() => setDismissed(true)}
            >
              Teraz nie
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
