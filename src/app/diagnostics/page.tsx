"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
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
      setReport(await buildDiagnosticsReport());
    } catch (error) {
      console.error("Failed to build diagnostics report:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void buildReport();
  }, []);

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(formatReport(report));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.warn("Clipboard write failed:", error);
    }
  };

  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg text-primary">Diagnostika</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={buildReport} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Znova overiť emulačné jadrá
          </Button>
          <Button size="sm" onClick={handleCopy} disabled={!report}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
            {copied ? "Skopírované" : "Kopírovať report"}
          </Button>
        </div>
      </div>

      {report && (
        <>
          <Card className="space-y-2 p-4">
            <SectionTitle>Prostredie</SectionTitle>
            <Row label="User Agent" value={report.userAgent} mono />
            <Row label="OS" value={report.operatingSystem} />
            <Row label="Typ zariadenia" value={report.deviceType} />
            <Row label="CPU jadrá" value={String(report.cpuCores)} />
            {report.deviceMemoryGb !== undefined && (
              <Row label="Pamäť (GB)" value={String(report.deviceMemoryGb)} />
            )}
          </Card>

          <Card className="space-y-2 p-4">
            <SectionTitle>Prehliadač</SectionTitle>
            <CapabilityRow label="WebAssembly" ok={report.capabilities.webAssembly} />
            <CapabilityRow label="WASM Threads" ok={!!report.capabilities.webAssemblyThreads} />
            <CapabilityRow label="SIMD" ok={!!report.capabilities.simd} />
            <CapabilityRow label="WebGL2" ok={report.capabilities.webgl2} />
            <CapabilityRow label="SharedArrayBuffer" ok={report.capabilities.sharedArrayBuffer} />
            <CapabilityRow label="Gamepad API" ok={report.capabilities.gamepadApi} />
            <CapabilityRow label="IndexedDB" ok={report.capabilities.indexedDB} />
            <CapabilityRow label="OPFS" ok={report.capabilities.opfs} />
          </Card>

          {report.emulatorAssets && (
            <Card className="space-y-2 p-4">
              <SectionTitle>Emulačné jadrá</SectionTitle>
              <CapabilityRow label="Manifest assetov" ok={report.emulatorAssets.manifest} />
              <CapabilityRow label="js-dos" ok={report.emulatorAssets.jsDos} />
              <CapabilityRow label="EmulatorJS / PCSX-ReARMed" ok={report.emulatorAssets.emulatorJs} />
              <CapabilityRow label="libarchive.js" ok={report.emulatorAssets.libarchive} />
              <p className="text-xs text-muted-foreground">
                Pre niektoré PS1 hry je potrebný vlastný PlayStation BIOS. Aplikácia BIOS neposkytuje.
              </p>
            </Card>
          )}

          {report.nativePlugins && (
            <Card className="space-y-2 p-4">
              <SectionTitle>Natívne Android pluginy</SectionTitle>
              {Object.entries(report.nativePlugins).map(([name, ok]) => (
                <CapabilityRow key={name} label={name} ok={ok} />
              ))}
            </Card>
          )}

          {report.storage && (
            <Card className="space-y-2 p-4">
              <SectionTitle>Úložisko</SectionTitle>
              {report.storage.quota !== undefined && (
                <Row label="Kvóta" value={formatBytes(report.storage.quota)} mono />
              )}
              {report.storage.usage !== undefined && (
                <Row label="Použité" value={formatBytes(report.storage.usage)} mono />
              )}
              <Row label="Perzistentné" value={report.storage.persistent ? "Áno" : "Nie"} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
      {children}
    </h2>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}:</span>
      <span className={`truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function CapabilityRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-xs font-mono ${ok ? "text-emerald-400" : "text-destructive"}`}>
        {ok ? "OK" : "Nie"}
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
    "Jaňo še chce bavkac Diagnostics Report",
    `Generated: ${new Date(r.collectedAt).toISOString()}`,
    "",
    "## Environment",
    `User Agent: ${r.userAgent}`,
    `OS: ${r.operatingSystem}`,
    `Device: ${r.deviceType}`,
    `CPU cores: ${r.cpuCores}`,
    "",
    "## Emulator assets",
    ...Object.entries(r.emulatorAssets ?? {}).map(([key, value]) => `  ${key}: ${value ? "yes" : "no"}`),
    "",
    "## Native plugins",
    ...Object.entries(r.nativePlugins ?? {}).map(([key, value]) => `  ${key}: ${value ? "yes" : "no"}`),
  ].join("\n");
}
