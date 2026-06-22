"use client";

import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="font-display text-lg text-primary">Ochrana súkromia</h1>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Lokálne ukladanie
        </h2>
        <p>
          Jaňo še chce bavkac ukladá hry, BIOS, save states a nastavenia lokálne do OPFS,
          IndexedDB alebo sessionStorage vo vašom zariadení. Herné súbory sa automaticky
          neposielajú na server.
        </p>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Čo sa môže ukladať
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Metadáta hier, napríklad názov, platforma a veľkosť.</li>
          <li>Save states a ich metadáta vrátane veľkosti a SHA-256 hashov.</li>
          <li>Nastavenia emulátora a ovládania.</li>
          <li>BIOS súbory, ktoré používateľ vloží lokálne.</li>
          <li>Dočasný Google OAuth token pri použití Drive Pickeru.</li>
        </ul>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Diagnostika
        </h2>
        <p>
          Diagnostický report ukazuje schopnosti prehliadača, stav emulačných jadier,
          dostupnosť Android pluginov a základné informácie o úložisku. Report neobsahuje
          heslá, tokeny, BIOS obsah ani súkromné herné súbory.
        </p>
      </Card>
    </div>
  );
}
