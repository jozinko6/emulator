"use client";

/**
 * DropZone — drag&drop zóna + file picker (multi-select) + File System Access API.
 *
 * Per prompt sekcia ETAPA 3. Podporuje:
 *  - drag&drop súborov z prieskumníka
 *  - click → file picker (multi-select, filter na podporované prípony)
 *  - File System Access API (ak je dostupné) — directory picker pre hromadný import
 *
 * Komentáre v slovenčine.
 */
import { useCallback, useRef, useState } from "react";
import { UploadCloud, FolderOpen, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ACCEPT_ATTR, detectFormat, isSupported } from "@/components/import/format-detection";

interface DropZoneProps {
  /** Volá sa s vybranými súbormi. */
  onFilesSelected: (files: File[]) => void;
  /** True, ak je rozbaľovanie v programe — zakáže interakciu. */
  disabled?: boolean;
}

export function DropZone({ onFilesSelected, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [unsupported, setUnsupported] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const accepted: File[] = [];
      const rejected: string[] = [];
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList.item(i);
        if (!file) continue;
        const fmt = detectFormat(file.name);
        if (isSupported(fmt)) {
          accepted.push(file);
        } else {
          rejected.push(file.name);
        }
      }
      setUnsupported(rejected);
      if (accepted.length > 0) {
        onFilesSelected(accepted);
      }
    },
    [onFilesSelected]
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles]
  );

  const onDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const onDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const onPickClick = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      // Reset, aby šlo vybrať ten istý súbor znova
      e.target.value = "";
    },
    [handleFiles]
  );

  // File System Access API — directory picker (ak je dostupné)
  const onPickDirectory = useCallback(async () => {
    if (disabled) return;
    // window.showDirectoryPicker môže chýbať — typové deklaráce ho nepoznajú,
    // preto pristupujeme cez indexovaný prístup.
    const w = window as unknown as {
      showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
    };
    if (!w.showDirectoryPicker) return;

    try {
      const dirHandle = await w.showDirectoryPicker();
      const collected: File[] = [];
      // Rekurzívne prejdeme adresár — obmedzíme hĺbku na 5 úrovní
      await collectFilesFromDirectory(dirHandle, collected, 0, 5);
      if (collected.length > 0) {
        onFilesSelected(collected);
      }
    } catch (e) {
      // Používateľ zrušil picker alebo chyba prístupu — ticho ignorujeme
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Iné chyby nahlasíme ako "nepodporované" pre UI
      setUnsupported([`Adresár nebolo možné načítať: ${e instanceof Error ? e.message : String(e)}`]);
    }
  }, [disabled, onFilesSelected]);

  return (
    <Card
      className={isDragging ? "border-primary ring-2 ring-primary/40" : ""}
      role="region"
      aria-label="Zóna pre nahranie súborov hier"
    >
      <CardContent className="p-6">
        <div
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed border-border p-8 text-center transition-colors"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UploadCloud className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-medium text-foreground">
              Pretiahnite sem súbory hier
            </p>
            <p className="text-sm text-muted-foreground">
              Podporované: ZIP, RAR, 7z, ISO, BIN+CUE, CHD, CSO, PBP, ELF, JSDOS, EXE, BAT
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={onPickClick}
              disabled={disabled}
              className="min-h-11"
            >
              <UploadCloud className="size-4" />
              Vybrať súbory
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onPickDirectory}
              disabled={disabled || !hasDirectoryPicker()}
              className="min-h-11"
              title={
                hasDirectoryPicker()
                  ? "Vybrať adresár s hrami"
                  : "File System Access API nie je v tomto prehliadači dostupné"
              }
            >
              <FolderOpen className="size-4" />
              Vybrať adresár
            </Button>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT_ATTR}
            onChange={onInputChange}
            className="sr-only"
            aria-label="Vyber súbory hier"
          />
        </div>

        {unsupported.length > 0 && (
          <div
            className="mt-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">Niektoré súbory boli preskočené:</p>
              <ul className="list-inside list-disc space-y-0.5 text-xs">
                {unsupported.slice(0, 5).map((name, i) => (
                  <li key={i}>{name}</li>
                ))}
                {unsupported.length > 5 && (
                  <li>...a ďalších {unsupported.length - 5}</li>
                )}
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skontroluje, či je dostupné File System Access API (directory picker).
 */
function hasDirectoryPicker(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker ===
      "function"
  );
}

/**
 * Rekurzívne prejde adresár a zozbiera všetky súbory.
 * Rekurzia je obmedzená na maxDepth úrovní.
 */
async function collectFilesFromDirectory(
  dirHandle: FileSystemDirectoryHandle,
  collected: File[],
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  // entries() je dostupné na FileSystemDirectoryHandle v moderných prehliadačoch.
  // TypeScript ho nepozná ako async iterable v starších verziách lib.dom.d.ts,
  // preto používame indexovaný prístup.
  const entries = (
    dirHandle as unknown as {
      entries?: () => AsyncIterable<[string, FileSystemHandle]>;
    }
  ).entries;
  if (!entries) return;

  for await (const [, handle] of entries.call(dirHandle)) {
    if (handle.kind === "file") {
      const fileHandle = handle as FileSystemFileHandle;
      try {
        const file = await fileHandle.getFile();
        // Filtrujeme podľa prípony — nepodporované preskakujeme
        if (isSupported(detectFormat(file.name))) {
          collected.push(file);
        }
      } catch (err) {
        // Súbor sa nedá prečítať (napr. kvóta, práva, poškodený) — zaznamenáme
        // a pokračujeme ďalšími súbormi, aby jeden zlý nezastavil celý adresár.
        console.warn(`[drop-zone] súbor "${fileHandle.name}" sa nedá prečítať:`, err);
      }
    } else if (handle.kind === "directory") {
      const subDir = handle as FileSystemDirectoryHandle;
      await collectFilesFromDirectory(subDir, collected, currentDepth + 1, maxDepth);
    }
  }
}
