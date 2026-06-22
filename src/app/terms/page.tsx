"use client";

import { Card } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Podmienky používania</h1>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          1. Prijatie podmienok
        </h2>
        <p>
          Používaním aplikácie RETROCLOUD súhlasíte s týmito podmienkami.
          Ak s nimi nesúhlasíte, aplikáciu nepoužívajte.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          2. Účel aplikácie
        </h2>
        <p>
          RETROCLOUD je nástroj na prehrávanie vlastných legálne získaných
          záložných kópií hier pre DOS, PlayStation 1 a PlayStation 2 v
          modernom webovom prehliadači.
        </p>
        <p>
          Aplikácia neposkytuje hry ani BIOS. Aplikácia nie je prevádzkovateľom
          žiadnej knižnice hier.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          3. Zodpovednosť používateľa
        </h2>
        <p>
          Používateľ potvrdzuje, že:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Všetky hry, ktoré do aplikácie načíta, sú jeho vlastné legálne získané záložné kópie.</li>
          <li>Má právo tento obsah používať v zmysle platnej legislatívy svojej krajiny.</li>
          <li>NEbude aplikáciu používať na prehrávanie pirátskych kópií hier.</li>
          <li>NEbude aplikáciu používať na distribúciu alebo zdieľanie hier tretím stranám.</li>
          <li>Je plnoletý alebo má súhlas zákonného zástupcu.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          4. Licencia emulačných jadier
        </h2>
        <p>
          Aplikácia využíva open-source emulačné jadrá pod ich pôvodnými
          licenciami:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>js-dos</strong> (DOS emulácia) — GPL-2.0</li>
          <li><strong>EmulatorJS / PCSX-ReARMed</strong> (PS1 emulácia) — GPL-2.0</li>
          <li><strong>Play!.js</strong> (PS2 emulácia, experimentálne) — MIT</li>
        </ul>
        <p>
          Zdrojové kódy týchto jadier sú dostupné na ich oficiálnych repozitároch.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          5. Zrieknutie sa záruky
        </h2>
        <p>
          Aplikácia sa poskytuje „tak, ako je" bez akejkoľvek záruky. Prevádzkovateľ
          nezaručuje, že aplikácia bude bezchybná, nepretržitá, alebo že bude
          fungovať s každým hardvérom a každou hrou. Kompatibilita jednotlivých
          hier závisí od emulačných jadier tretích strán.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          6. Obmedzenie zodpovednosti
        </h2>
        <p>
          Prevádzkovateľ nenesie zodpovednosť za žiadne škody vyplývajúce z
          používania aplikácie, vrátane straty dát, zlyhania hardvéru alebo
          neoprávneného použitia hier tretími osobami v zariadení používateľa.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          7. Zmeny podmienok
        </h2>
        <p>
          Podmienky sa môžu zmeniť. Aktuálne znenie je vždy dostupné na tejto
          stránke. Pokračovaním používania aplikácie po zmene používateľ
          súhlasí s novým znením.
        </p>
      </Card>
    </div>
  );
}
