"use client";

import { Card } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Podmienky pouĹľĂ­vania</h1>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          1. Prijatie podmienok
        </h2>
        <p>
          PouĹľĂ­vanĂ­m aplikĂˇcie Jaňo še chce bavkac sĂşhlasĂ­te s tĂ˝mito podmienkami.
          Ak s nimi nesĂşhlasĂ­te, aplikĂˇciu nepouĹľĂ­vajte.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          2. ĂšÄŤel aplikĂˇcie
        </h2>
        <p>
          Jaňo še chce bavkac je nĂˇstroj na prehrĂˇvanie vlastnĂ˝ch legĂˇlne zĂ­skanĂ˝ch
          zĂˇloĹľnĂ˝ch kĂłpiĂ­ hier pre DOS, PlayStation 1 a PlayStation 2 v
          modernom webovom prehliadaÄŤi.
        </p>
        <p>
          AplikĂˇcia neposkytuje hry ani BIOS. AplikĂˇcia nie je prevĂˇdzkovateÄľom
          Ĺľiadnej kniĹľnice hier.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          3. ZodpovednosĹĄ pouĹľĂ­vateÄľa
        </h2>
        <p>
          PouĹľĂ­vateÄľ potvrdzuje, Ĺľe:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>VĹˇetky hry, ktorĂ© do aplikĂˇcie naÄŤĂ­ta, sĂş jeho vlastnĂ© legĂˇlne zĂ­skanĂ© zĂˇloĹľnĂ© kĂłpie.</li>
          <li>MĂˇ prĂˇvo tento obsah pouĹľĂ­vaĹĄ v zmysle platnej legislatĂ­vy svojej krajiny.</li>
          <li>NEbude aplikĂˇciu pouĹľĂ­vaĹĄ na prehrĂˇvanie pirĂˇtskych kĂłpiĂ­ hier.</li>
          <li>NEbude aplikĂˇciu pouĹľĂ­vaĹĄ na distribĂşciu alebo zdieÄľanie hier tretĂ­m stranĂˇm.</li>
          <li>Je plnoletĂ˝ alebo mĂˇ sĂşhlas zĂˇkonnĂ©ho zĂˇstupcu.</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          4. Licencia emulaÄŤnĂ˝ch jadier
        </h2>
        <p>
          AplikĂˇcia vyuĹľĂ­va open-source emulaÄŤnĂ© jadrĂˇ pod ich pĂ´vodnĂ˝mi
          licenciami:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>js-dos</strong> (DOS emulĂˇcia) â€” GPL-2.0</li>
          <li><strong>EmulatorJS / PCSX-ReARMed</strong> (PS1 emulĂˇcia) â€” GPL-2.0</li>
          <li><strong>Play!.js</strong> (PS2 emulĂˇcia, experimentĂˇlne) â€” MIT</li>
        </ul>
        <p>
          ZdrojovĂ© kĂłdy tĂ˝chto jadier sĂş dostupnĂ© na ich oficiĂˇlnych repozitĂˇroch.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          5. Zrieknutie sa zĂˇruky
        </h2>
        <p>
          AplikĂˇcia sa poskytuje â€žtak, ako je" bez akejkoÄľvek zĂˇruky. PrevĂˇdzkovateÄľ
          nezaruÄŤuje, Ĺľe aplikĂˇcia bude bezchybnĂˇ, nepretrĹľitĂˇ, alebo Ĺľe bude
          fungovaĹĄ s kaĹľdĂ˝m hardvĂ©rom a kaĹľdou hrou. Kompatibilita jednotlivĂ˝ch
          hier zĂˇvisĂ­ od emulaÄŤnĂ˝ch jadier tretĂ­ch strĂˇn.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          6. Obmedzenie zodpovednosti
        </h2>
        <p>
          PrevĂˇdzkovateÄľ nenesie zodpovednosĹĄ za Ĺľiadne Ĺˇkody vyplĂ˝vajĂşce z
          pouĹľĂ­vania aplikĂˇcie, vrĂˇtane straty dĂˇt, zlyhania hardvĂ©ru alebo
          neoprĂˇvnenĂ©ho pouĹľitia hier tretĂ­mi osobami v zariadenĂ­ pouĹľĂ­vateÄľa.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          7. Zmeny podmienok
        </h2>
        <p>
          Podmienky sa mĂ´Ĺľu zmeniĹĄ. AktuĂˇlne znenie je vĹľdy dostupnĂ© na tejto
          strĂˇnke. PokraÄŤovanĂ­m pouĹľĂ­vania aplikĂˇcie po zmene pouĹľĂ­vateÄľ
          sĂşhlasĂ­ s novĂ˝m znenĂ­m.
        </p>
      </Card>
    </div>
  );
}
