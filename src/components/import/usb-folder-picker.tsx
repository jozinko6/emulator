"use client";

/**
 * UsbFolderPicker — per prompt sections 10 (PC USB) + 11 (Android USB).
 *
 * PC:
 *   - File System Access API (showDirectoryPicker) — primárne, zachová štruktúru
 *   - <input webkitdirectory> — fallback pre Chrome / Edge
 *   - Štandardný file picker pre jednotlivé súbory z USB
 *
 * Android:
 *   - Storage Access Framework cez native-file-picker plugin
 *   - ACTION_OPEN_DOCUMENT_TREE pre priečinok
 *   - ACTION_OPEN_DOCUMENT pre súbory
 */
import { useCallback, useRef, useState } from "react";
import { Usb, FolderOpen, HardDrive, Smartphone, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRuntimeInfo, isAndroid } from "@/lib/native/native-platform";
import {
  pickAndroidFiles,
  pickAndroidDirectory,
  type PickedAndroidFile,
  type PickedAndroidDirectory,
} from "@/lib/native/native-file-picker";

export interface PickedFileEntry {
  /** Relatívna cesta (zachovaná štruktúra z priečinka). */
  relativePath: string;
  /** Súbor (pre PC) alebo null (pre Android — súbor je už v app storage). */
  file: File | null;
  /** Pôvodný názov súboru. */
  name: string;
  /** Veľkosť v bajtoch. */
  size: number;
  /** MIME typ (ak je známy). */
  mimeType: string;
  /** Interná cesta v app storage (pre Android). */
  internalPath?: string;
}

interface UsbFolderPickerProps {
  onFilesSelected: (entries: PickedFileEntry[]) => void;
  disabled?: boolean;
}

export function UsbFolderPicker({ onFilesSelected, disabled }: UsbFolderPickerProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputDirRef = useRef<HTMLInputElement>(null);

  const isAndroidDevice = isAndroid();
  const info = typeof window !== "undefined" ? getRuntimeInfo() : null;
  const hasFileSystemAccess =
    typeof window !== "undefined" && typeof window.showDirectoryPicker === "function";

  const handlePcDirectoryPicker = useCallback(async () => {
    if (!hasFileSystemAccess) {
      // Fallback na webkitdirectory input
      inputDirRef.current?.click();
      return;
    }
    setBusy(true);
    setError(null);
    try {
       
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: "read",
      });
      const entries: PickedFileEntry[] = [];
      await walkDirectoryHandle(dirHandle, "", entries);
      if (entries.length === 0) {
        setError("Vybraný priečinok neobsahuje žiadne súbory.");
      } else {
        onFilesSelected(entries);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [hasFileSystemAccess, onFilesSelected]);

  const handleWebkitDirectory = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        const entries: PickedFileEntry[] = [];
        // webkitdirectory dáva files s relativePath v atribúte webkitRelativePath
        for (let i = 0; i < files.length; i++) {
          const file = files.item(i);
          if (!file) continue;
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath ?? file.name;
          entries.push({
            relativePath: relPath,
            file,
            name: file.name,
            size: file.size,
            mimeType: file.type || "application/octet-stream",
          });
        }
        onFilesSelected(entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
        // Reset input aby sa dal použiť znova
        if (inputDirRef.current) inputDirRef.current.value = "";
      }
    },
    [onFilesSelected]
  );

  const handleAndroidPickFiles = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickAndroidFiles({ multiple: true });
      if (picked === null) {
        // Plugin nie je dostupný — fallback
        setError("Android file picker nie je dostupný v tomto prostredí.");
        return;
      }
      const entries: PickedFileEntry[] = picked.map((f: PickedAndroidFile) => ({
        relativePath: f.name,
        file: null,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        internalPath: f.internalPath,
      }));
      onFilesSelected(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onFilesSelected]);

  const handleAndroidPickDirectory = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await pickAndroidDirectory();
      if (picked === null) {
        setError("Android directory picker nie je dostupný v tomto prostredí.");
        return;
      }
      const entries: PickedFileEntry[] = picked.files.map((f: PickedAndroidFile) => ({
        relativePath: f.internalPath.replace(picked.internalPath + "/", "").replace(/^\//, ""),
        file: null,
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        internalPath: f.internalPath,
      }));
      onFilesSelected(entries);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [onFilesSelected]);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Usb className="h-4 w-4 text-primary" />
        <h3 className="font-display text-xs uppercase tracking-widest text-muted-foreground">
          Importovať z USB alebo disku
        </h3>
      </div>

      {error && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/5 p-2 rounded">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isAndroidDevice ? (
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={handleAndroidPickFiles}
            disabled={busy || disabled}
            className="h-auto py-4 flex-col gap-1"
          >
            <HardDrive className="h-5 w-5" />
            <span className="text-xs">Vybrať súbory</span>
            <span className="text-[10px] text-muted-foreground">BIN + CUE, ZIP, ...</span>
          </Button>
          <Button
            variant="outline"
            onClick={handleAndroidPickDirectory}
            disabled={busy || disabled}
            className="h-auto py-4 flex-col gap-1"
          >
            <FolderOpen className="h-5 w-5" />
            <span className="text-xs">Vybrať priečinok</span>
            <span className="text-[10px] text-muted-foreground">USB / externé úložisko</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <Button
            variant="outline"
            onClick={handlePcDirectoryPicker}
            disabled={busy || disabled}
            className="h-auto py-4 flex items-center gap-3 justify-start px-4"
          >
            <FolderOpen className="h-5 w-5 text-primary shrink-0" />
            <div className="text-left">
              <div className="text-sm font-medium">Vybrať priečinok z USB</div>
              <div className="text-[10px] text-muted-foreground">
                {hasFileSystemAccess
                  ? "File System Access API — zachová adresárovú štruktúru"
                  : "Prehliadač bez FSA — fallback na webkitdirectory"}
              </div>
            </div>
          </Button>
          {!hasFileSystemAccess && (
            <input
              ref={inputDirRef}
              type="file"
              multiple
              // @ts-expect-error — webkitdirectory je neštandardný ale podporovaný
              webkitdirectory=""
              className="hidden"
              onChange={handleWebkitDirectory}
            />
          )}
          <div className="text-[10px] text-muted-foreground flex items-start gap-1">
            <Smartphone className="h-3 w-3 shrink-0 mt-0.5" />
            <span>
              Tlačidlo otvorí systémový dialóg — zobrazí dostupné jednotky vrátane USB kľúča.
              Aplikácia automaticky neprehľadáva zariadenia bez súhlasu používateľa.
            </span>
          </div>
          {info?.platform === "android-tv" && (
            <div className="text-xs text-amber-400 flex items-center gap-2">
              <Smartphone className="h-3 w-3" />
              Android TV: použite D-pad na výber položiek.
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/** Rekurzívne prejde FileSystemDirectoryHandle a nazbiera súbory. */
async function walkDirectoryHandle(
   
  dirHandle: any,
  prefix: string,
  out: PickedFileEntry[]
): Promise<void> {
   
  for await (const entry of (dirHandle as any).values()) {
    if (entry.kind === "file") {
      const file = await entry.getFile();
      out.push({
        relativePath: prefix ? `${prefix}/${entry.name}` : entry.name,
        file,
        name: entry.name,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
      });
    } else if (entry.kind === "directory") {
      await walkDirectoryHandle(
        entry,
        prefix ? `${prefix}/${entry.name}` : entry.name,
        out
      );
    }
  }
}
