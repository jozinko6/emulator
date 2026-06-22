"use client";

import { Card } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="font-display text-lg text-primary">Podmienky používania</h1>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          1. Účel aplikácie
        </h2>
        <p>
          Jaňo še chce bavkac je nástroj na lokálne prehrávanie vlastných legálne získaných
          záložných kópií DOS a PlayStation 1 hier. Aplikácia neposkytuje hry ani BIOS.
        </p>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          2. Zodpovednosť používateľa
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Používateľ importuje iba obsah, ktorý vlastní alebo má právo používať.</li>
          <li>Používateľ nepoužíva aplikáciu na distribúciu hier tretím stranám.</li>
          <li>Používateľ si zabezpečí vlastný PlayStation BIOS, ak ho hra vyžaduje.</li>
        </ul>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          3. Licencie runtime jadier
        </h2>
        <p>
          Aplikácia používa open-source runtime jadrá pod ich pôvodnými licenciami:
          js-dos, EmulatorJS / PCSX-ReARMed a libarchive.js. Žiadne hry ani BIOS nie sú
          súčasťou týchto assetov.
        </p>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          4. Bez záruky
        </h2>
        <p>
          Aplikácia sa poskytuje bez záruky. Kompatibilita konkrétnych hier závisí od
          emulačných jadier, prehliadača, zariadenia a legálne dodaných súborov používateľa.
        </p>
      </Card>
    </div>
  );
}
