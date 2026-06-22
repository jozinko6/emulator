"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function LegalPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">PrĂˇvne informĂˇcie</h1>

      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm">
            <p className="font-medium text-amber-300">DĂ´leĹľitĂ© upozornenie</p>
            <p>
              Jaňo še chce bavkac neposkytuje hry, BIOS ani Ĺľiadny chrĂˇnenĂ˝ obsah.
              AplikĂˇcia je nĂˇstroj na prehrĂˇvanie vlastnĂ˝ch legĂˇlne zĂ­skanĂ˝ch
              zĂˇloĹľnĂ˝ch kĂłpiĂ­ hier.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          ÄŚo Jaňo še chce bavkac nedĂˇva
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>NEposkytuje komerÄŤnĂ© ani voÄľne ĹˇĂ­riteÄľnĂ© hry.</li>
          <li>NEposkytuje BIOS pre PlayStation ani inĂ© konzoly.</li>
          <li>NEponĂşka verejnĂş kniĹľnicu ROM, ISO alebo BIN sĂşborov.</li>
          <li>NEpodporuje zdieÄľanie komerÄŤnĂ˝ch hier medzi pouĹľĂ­vateÄľmi.</li>
          <li>NEukladĂˇ hernĂ© sĂşbory na svoje servery.</li>
          <li>NEodporĂşÄŤa ani NEusmernzuje pouĹľĂ­vateÄľov k zĂ­skavaniu hier nelegĂˇlnou cestou.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          ÄŚo Jaňo še chce bavkac robĂ­
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>VĹˇetky hernĂ© sĂşbory (ROM, ISO, BIN, CHD, CSO, PBP, ELF, JSDOS) zostĂˇvajĂş vĂ˝hradne v lokĂˇlnom ĂşloĹľisku vĂˇĹˇho zariadenia (OPFS).</li>
          <li>MetadĂˇta hier, save states a nastavenia sa ukladajĂş do IndexedDB v prehliadaÄŤi.</li>
          <li>Ak je povolenĂ˝ voliteÄľnĂ˝ Supabase ĂşÄŤet, synchronizujĂş sa iba metadĂˇta â€” nikdy obsah hier.</li>
          <li>AplikĂˇcia funguje bez pouĹľĂ­vateÄľskĂ©ho ĂşÄŤtu a bez internetovĂ©ho pripojenia (PWA offline).</li>
          <li>ZdrojovĂ© kĂłdy emulaÄŤnĂ˝ch jadier (js-dos, EmulatorJS, PCSX-ReARMed) sĂş open-source pod ich pĂ´vodnĂ˝mi licenciami.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          ZodpovednosĹĄ pouĹľĂ­vateÄľa
        </h2>
        <p>
          PouĹľĂ­vateÄľ je vĂ˝luÄŤne zodpovednĂ˝ za to, Ĺľe vĹˇetky hry a BIOS, ktorĂ© do
          aplikĂˇcie naÄŤĂ­ta, sĂş jeho vlastnĂ© legĂˇlne zĂ­skanĂ© zĂˇloĹľnĂ© kĂłpie a Ĺľe
          pouĹľĂ­vateÄľ mĂˇ prĂˇvo tento obsah pouĹľĂ­vaĹĄ.
        </p>
        <p>
          V mnohĂ˝ch jurisdikciĂˇch je vytvorenie zĂˇloĹľnej kĂłpie softvĂ©ru, ktorĂ˝
          pouĹľĂ­vateÄľ vlastnĂ­, povolenĂ©. V inĂ˝ch nie. PouĹľĂ­vateÄľ si overĂ­
          platnĂş legislatĂ­vu vo svojej krajine.
        </p>
      </Card>

      <Card className="p-4 space-y-2 text-sm">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          SĂşvisiace dokumenty
        </h2>
        <div className="flex flex-col gap-1">
          <Link href="/privacy" className="text-primary hover:underline">Ochrana sĂşkromia â†’</Link>
          <Link href="/terms" className="text-primary hover:underline">Podmienky pouĹľĂ­vania â†’</Link>
        </div>
      </Card>
    </div>
  );
}
