"use client";

import { useEffect, useState } from "react";
import { Copy, Check, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DiagnosticsReport } from "@/types/diagnostics";

export default function DiagnosticsPage() {
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  const buildReport = async () => {
    setLoading(true);
    try {
      const { buildDiagnosticsReport } = await import("@/lib/diagnostics/report-builder");
      const r = await buildDiagnosticsReport();
      setReport(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    buildReport();
  }, []);

  const handleCopy = async () => {
    if (!report) return;
    const text = formatReport(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg text-primary">Diagnostika</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={buildReport} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Obnoviť
          </Button>
          <Button size="sm" onClick={handleCopy} disabled={!report}>
            {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? "Skopírované" : "Kopírovať report"}
          </Button>
        </div>
      </div>

      {report && (
        <>
          <Card className="p-4 space-y-2">
            <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Prostredie
            </h2>
            <Row label="User Agent" value={report.userAgent} mono />
            <Row label="OS" value={report.operatingSystem} />
            <Row label="Typ zariadenia" value={report.deviceType} />
            <Row label="CPU jadra" value={String(report.cpuCores)} />
            {report.deviceMemoryGb !== undefined && (
              <Row label="Pamäť (GB)" value={String(report.deviceMemoryGb)} />
            )}
          </Card>

          <Card className="p-4 space-y-2">
            <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
              Prehliadač — schopnosti
            </h2>
            <CapabilityRow label="WebAssembly" ok={report.capabilities.webAssembly} />
            <CapabilityRow
              label="WASM Threads"
              ok={!!report.capabilities.webAssemblyThreads}
            />
            <CapabilityRow label="SIMD" ok={!!report.capabilities.simd} />
            <CapabilityRow label="WebGL" ok={report.capabilities.webgl} />
            <CapabilityRow label="WebGL2" ok={report.capabilities.webgl2} />
            {report.capabilities.webglRenderer && (
              <Row label="Renderer" value={report.capabilities.webglRenderer} mono />
            )}
            <CapabilityRow
              label="SharedArrayBuffer"
              ok={report.capabilities.sharedArrayBuffer}
            />
            <CapabilityRow
              label="crossOriginIsolated"
              ok={report.capabilities.crossOriginIsolated}
            />
            <CapabilityRow label="AudioContext" ok={report.capabilities.audioContext} />
            <CapabilityRow label="Gamepad API" ok={report.capabilities.gamepadApi} />
            <CapabilityRow label="IndexedDB" ok={report.capabilities.indexedDB} />
            <CapabilityRow label="OPFS" ok={report.capabilities.opfs} />
            <CapabilityRow label="Service Worker" ok={report.capabilities.serviceWorker} />
            <CapabilityRow label="Storage API" ok={report.capabilities.storageApi} />
            <CapabilityRow
              label="File System Access"
              ok={report.capabilities.fileSystemAccess}
            />
            <CapabilityRow label="Touch" ok={report.capabilities.touch} />
            <CapabilityRow label="Vibration" ok={report.capabilities.vibration} />
          </Card>

          {report.storage && (
            <Card className="p-4 space-y-2">
              <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                Úložisko
              </h2>
              {report.storage.quota !== undefined && (
                <Row label="Kvóta" value={formatBytes(report.storage.quota)} mono />
              )}
              {report.storage.usage !== undefined && (
                <Row label="Použité" value={formatBytes(report.storage.usage)} mono />
              )}
              <Row
                label="Perzistentné"
                value={report.storage.persistent ? "Áno" : "Nie"}
              />
            </Card>
          )}

          {report.connectedGamepads.length > 0 && (
            <Card className="p-4 space-y-2">
              <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                Pripojené ovládače ({report.connectedGamepads.length})
              </h2>
              {report.connectedGamepads.map((g) => (
                <div
                  key={g.index}
                  className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-1 last:pb-0"
                >
                  <span className="font-mono text-xs truncate">{g.id}</span>
                  <span className="text-xs text-muted-foreground ml-2 shrink-0">
                    {g.buttons} tlačidiel, {g.axes} osí
                  </span>
                </div>
              ))}
            </Card>
          )}

          {report.recentErrors.length > 0 && (
            <Card className="p-4 space-y-2">
              <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
                Posledné chyby ({report.recentErrors.length})
              </h2>
              {report.recentErrors.map((e, i) => (
                <div key={i} className="text-xs">
                  <span className="text-destructive">{e.code}</span>: {e.message}
                  <span className="text-muted-foreground ml-2">
                    {new Date(e.timestamp).toLocaleTimeString("sk")}
                  </span>
                </div>
              ))}
            </Card>
          )}

          <p className="text-[10px] text-muted-foreground">
            Report neobsahuje tokeny, heslá, BIOS obsah ani názvy Drive súborov.
          </p>
        </>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-2">
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className={`truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function CapabilityRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-xs font-mono ${ok ? "text-emerald-400" : "text-destructive"}`}
      >
        {ok ? "✓" : "✗"}
      </span>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatReport(r: DiagnosticsReport): string {
  return [
    `RETROCLOUD Diagnostics Report`,
    `Generated: ${new Date(r.collectedAt).toISOString()}`,
    ``,
    `## Environment`,
    `User Agent: ${r.userAgent}`,
    `OS: ${r.operatingSystem}`,
    `Device: ${r.deviceType}`,
    `CPU cores: ${r.cpuCores}`,
    `Memory: ${r.deviceMemoryGb ?? "n/a"} GB`,
    ``,
    `## Capabilities`,
    ...Object.entries(r.capabilities).map(
      ([k, v]) => `  ${k}: ${v ? "yes" : "no"}`
    ),
    ``,
    `## Storage`,
    `  quota: ${r.storage?.quota ?? "n/a"}`,
    `  usage: ${r.storage?.usage ?? "n/a"}`,
    `  persistent: ${r.storage?.persistent ?? "n/a"}`,
    ``,
    `## Gamepads (${r.connectedGamepads.length})`,
    ...r.connectedGamepads.map(
      (g) => `  [${g.index}] ${g.id} (${g.buttons} btn, ${g.axes} axes)`
    ),
    ``,
    `## Recent errors`,
    ...r.recentErrors.map(
      (e) => `  ${e.code} @ ${new Date(e.timestamp).toISOString()}: ${e.message}`
    ),
  ].join("\n");
}
