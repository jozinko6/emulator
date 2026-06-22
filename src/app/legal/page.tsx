"use client";

import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function LegalPage() {
  return (
    <div className="container mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="font-display text-lg text-primary">Právne informácie</h1>

      <Card className="border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-300">Dôležité upozornenie</p>
            <p>
              Jaňo še chce bavkac neposkytuje hry, ROM, ISO, BIOS ani iný chránený obsah.
              Aplikácia je určená iba na prehrávanie vlastných legálne získaných záložných kópií hier.
            </p>
          </div>
        </div>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Čo aplikácia neposkytuje
        </h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Žiadne hry, ROM, ISO, BIN, CUE ani archívy s hrami.</li>
          <li>Žiadny PlayStation BIOS ani BIOS iných konzol.</li>
          <li>Žiadnu verejnú knižnicu hier ani zdieľanie obsahu medzi používateľmi.</li>
          <li>Žiadne nahrávanie herných súborov na server.</li>
        </ul>
      </Card>

      <Card className="space-y-3 p-4 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Zodpovednosť používateľa
        </h2>
        <p>
          Používateľ zodpovedá za to, že každý importovaný súbor a BIOS pochádza z jeho vlastného
          legálneho zdroja a že ho môže používať podľa zákonov svojej krajiny.
        </p>
        <p>
          Pre niektoré PS1 hry je potrebný vlastný PlayStation BIOS. Aplikácia BIOS neposkytuje.
        </p>
      </Card>

      <Card className="space-y-2 p-4 text-sm">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Súvisiace dokumenty
        </h2>
        <div className="flex flex-col gap-1">
          <Link href="/privacy" className="text-primary hover:underline">Ochrana súkromia</Link>
          <Link href="/terms" className="text-primary hover:underline">Podmienky používania</Link>
        </div>
      </Card>
    </div>
  );
}
