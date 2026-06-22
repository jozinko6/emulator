"use client";

import { useEffect, useState } from "react";
import { Download, Smartphone, Tv, ShieldCheck, AlertCircle, FileDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAndroidReleaseInfo } from "@/lib/android-release";
import type { AndroidReleaseInfo } from "@/types/android-release";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function AndroidDownloadSection() {
  const [info, setInfo] = useState<AndroidReleaseInfo | null | undefined>(undefined);
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    getAndroidReleaseInfo().then(setInfo);
  }, []);

  if (info === undefined) {
    // Loading
    return (
      <Card className="p-6">
        <div className="h-24 animate-pulse bg-muted/30 rounded" />
      </Card>
    );
  }

  // APK sa pripravuje — korektné vypnutie
  if (info === null || !info.enabled) {
    return (
      <Card className="p-6 space-y-3 border-amber-500/30 bg-amber-500/5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-display text-base text-amber-300">
              Android aplikácia sa pripravuje
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pracujeme na natívnej Android aplikácii pre telefóny, tablety a Android TV
              s podporou gamepadu, USB importu a offline režimu. APK bude dostupné na stiahnutie
              po dokončení build pipeline v GitHub Actions.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Pred produkciou bude APK podpísané a overené. Sledujte GitHub Releases.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  // Reálne APK je dostupné
  const hasUniversal = !!info.universalApkUrl;
  const hasSeparate = !!info.mobileApkUrl && !!info.tvApkUrl;

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 ring-1 ring-primary/30">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-base text-primary">Stiahnuť Android aplikáciu</h3>
          <p className="text-xs text-muted-foreground">
            Verzia {info.version} · {formatBytes(info.sizeBytes)} · {info.minAndroidVersion}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {hasUniversal ? (
          <Button asChild size="lg" className="h-auto py-4">
            <a href={info.universalApkUrl} download>
              <FileDown className="h-5 w-5 mr-2" />
              Stiahnuť Android APK
            </a>
          </Button>
        ) : hasSeparate ? (
          <>
            <Button asChild size="lg" className="h-auto py-4">
              <a href={info.mobileApkUrl} download>
                <Smartphone className="h-5 w-5 mr-2" />
                Stiahnuť pre Android
              </a>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-auto py-4">
              <a href={info.tvApkUrl} download>
                <Tv className="h-5 w-5 mr-2" />
                Stiahnuť pre Android TV
              </a>
            </Button>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Dátum vydania:</span>
            <span className="font-mono">
              {info.releasedAt
                ? new Date(info.releasedAt).toLocaleDateString("sk")
                : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Min. Android:</span>
            <span>{info.minAndroidVersion}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Veľkosť:</span>
            <span className="font-mono">{formatBytes(info.sizeBytes)}</span>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="text-muted-foreground">SHA-256:</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[10px] font-mono break-all flex-1 text-foreground/70">
              {info.sha256 || "—"}
            </code>
            {info.sha256 && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(info.sha256);
                    setCopiedSha(true);
                    setTimeout(() => setCopiedSha(false), 1500);
                  } catch {
                    // Ignored
                  }
                }}
              >
                {copiedSha ? "✓" : "Kopírovať"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground">Návod na inštaláciu</summary>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Stiahnite APK do svojho Android zariadenia.</li>
          <li>V Nastavenia → Aplikácie povolte „Inštalácia z neznámych zdrojov" pre váš prehliadač alebo súborový manažér.</li>
          <li>Otvorte stiahnutý APK súbor a potvrďte inštaláciu.</li>
          <li>Spustite aplikáciu „Jaňo še chce bavkac" z launchera.</li>
          <li>Importujte hry z USB kľúča alebo interného úložiska.</li>
        </ol>
      </details>
    </Card>
  );
}
