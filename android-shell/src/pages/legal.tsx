import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export function LegalPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Právne informácie</h1>

      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-300">Dôležité upozornenie</p>
            <p>
              Aplikácia neposkytuje hry, BIOS ani žiadny chránený obsah.
              Aplikácia je nástroj na prehrávanie vlastných legálne získaných
              záložných kópií hier.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Čo aplikácia nedáva
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>NEposkytuje komerčné ani voľne šíriteľné hry.</li>
          <li>NEposkytuje BIOS pre PlayStation ani iné konzoly.</li>
          <li>NEponúka verejnú knižnicu ROM, ISO alebo BIN súborov.</li>
          <li>NEukladá herné súbory na svoje servery.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Čo aplikácia robí
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Všetky herné súbory zostávajú v lokálnom úložisku vášho zariadenia (OPFS).</li>
          <li>Metadáta hier, save states a nastavenia sa ukladajú do IndexedDB v prehliadači.</li>
          <li>Aplikácia funguje bez používateľského účtu a bez internetového pripojenia (PWA offline).</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Zodpovednosť používateľa
        </h2>
        <p>
          Používateľ je výlučne zodpovedný za to, že všetky hry a BIOS, ktoré do
          aplikácie načíta, sú jeho vlastné legálne získané záložné kópie a že
          používateľ má právo tento obsah používať.
        </p>
      </Card>
    </div>
  );
}
