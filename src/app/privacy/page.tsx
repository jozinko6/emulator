"use client";

import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Ochrana súkromia</h1>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Lokálna priorita
        </h2>
        <p>
          RETROCLOUD je navrhnutý ako lokálne orientovaná aplikácia. Všetky vaše
          herné súbory (ROM, ISO, BIN, CHD, CSO, PBP, ELF, JSDOS), BIOS, save
          states a nastavenia sa ukladajú výhradne do vášho zariadenia — do
          Origin Private File System (OPFS) a IndexedDB v prehliadači.
        </p>
        <p>
          Žiadne herné dáta sa automaticky neodosielajú na servery RETROCLOUD
          ani na servery tretích strán.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Čo sa ukladá
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Metadáta hier (názov, platforma, veľkosť) — v IndexedDB</li>
          <li>Save states — v OPFS (blob data) + IndexedDB (metadáta)</li>
          <li>Nastavenia emulátora a ovládania — v IndexedDB</li>
          <li>BIOS súbory — v OPFS (nikdy sa neposielajú na server)</li>
          <li>Google OAuth token (ak používate Drive Picker) — v sessionStorage (zmizne pri zatvorení karty)</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Voliteľný Supabase účet
        </h2>
        <p>
          Ak sa prihlásite do voliteľného účtu (Supabase), synchronizujú sa
          medzi vašimi zariadeniami iba:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Metadáta hier (nie samotné ROM/ISO)</li>
          <li>Nastavenia emulátora a ovládania</li>
          <li>Metadáta save states (nie samotné súbory)</li>
          <li>História hrania</li>
        </ul>
        <p>
          Supabase účet je voliteľný. Aplikácia plne funguje bez neho.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Google Drive
        </h2>
        <p>
          Ak použijete Google Drive Picker, RETROCLOUD vyžiada o najmenší
          možný rozsah oprávnení (<code>drive.file</code>) — prístup iba k
          súborom, ktoré v Picker-i vyberiete.
        </p>
        <p>
          OAuth token sa ukladá iba v sessionStorage a po zatvorení karty
          zmizne. RETROCLOUD nikdy neukladá token do localStorage ani na server.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Diagnostika
        </h2>
        <p>
          Diagnostická stránka zbiera informácie o vašom prehliadači (typ,
          verzia, podporované API) za účelom riešenia problémov. Tieto dáta
          sa zobrazia iba vám a môžete ich skopírovať do schránky. Nikdy sa
          automaticky neodosielajú.
        </p>
        <p>
          Report neobsahuje tokeny, heslá, BIOS obsah ani názvy vašich
          súkromných Google Drive súborov.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Cookies a sledovanie
        </h2>
        <p>
          RETROCLOUD nepoužíva reklamné cookies ani sledovacie služby
          tretích strán (Google Analytics, Facebook Pixel atď.).
        </p>
      </Card>
    </div>
  );
}
