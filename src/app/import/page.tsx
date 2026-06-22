"use client";

/**
 * Import wizard page — renderuje `<ImportWizard />` + `<UsbFolderPicker />`.
 *
 * Per prompt sekcia ETAPA 3 + sekcia 10 (USB import na PC) + sekcia 11 (Android USB import).
 * Route: `/import`.
 */
import { ImportWizard } from "@/components/import/import-wizard";
import { UsbFolderPicker } from "@/components/import/usb-folder-picker";
import type { PickedFileEntry } from "@/components/import/usb-folder-picker";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function ImportPage() {
  const handleUsbFiles = async (entries: PickedFileEntry[]) => {
    // Tu by sa volal import pipeline (rovnaký wizard, len s iným zdrojom).
    // Detailná implementácia je v import-wizard.tsx — sem by sa pridala cesta
    // cez "storing" stav s OPFS streaming.
    console.log("USB files picked:", entries.length, "entries");
    // TODO: prepojiť s existujúcim import-store workflowom
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:py-10 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Importovať hru
        </h1>
        <p className="text-sm text-muted-foreground">
          Pridajte vlastnú záložnú kópiu hry do knižnice. Hry sa ukladajú lokálne
          do OPFS a nikdy sa neodosielajú na server.
        </p>
      </header>

      <UsbFolderPicker onFilesSelected={handleUsbFiles} />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-xs text-muted-foreground">
            alebo
          </span>
        </div>
      </div>

      <ImportWizard />

      <Card className="p-3 bg-card/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            <strong className="text-foreground">Podporované formáty:</strong>{" "}
            DOS — ZIP, RAR, JSDOS, EXE, COM, BAT, priečinok · PS1 — BIN+CUE, viacero BIN,
            CHD, PBP, ZIP, RAR. Pri výbere priečinka sa zachová adresárová štruktúra.
          </p>
        </div>
      </Card>
    </div>
  );
}
