"use client";

import { Card } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Ochrana sĂşkromia</h1>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          LokĂˇlna priorita
        </h2>
        <p>
          Jaňo še chce bavkac je navrhnutĂ˝ ako lokĂˇlne orientovanĂˇ aplikĂˇcia. VĹˇetky vaĹˇe
          hernĂ© sĂşbory (ROM, ISO, BIN, CHD, CSO, PBP, ELF, JSDOS), BIOS, save
          states a nastavenia sa ukladajĂş vĂ˝hradne do vĂˇĹˇho zariadenia â€” do
          Origin Private File System (OPFS) a IndexedDB v prehliadaÄŤi.
        </p>
        <p>
          Ĺ˝iadne hernĂ© dĂˇta sa automaticky neodosielajĂş na servery Jaňo še chce bavkac
          ani na servery tretĂ­ch strĂˇn.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          ÄŚo sa ukladĂˇ
        </h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>MetadĂˇta hier (nĂˇzov, platforma, veÄľkosĹĄ) â€” v IndexedDB</li>
          <li>Save states â€” v OPFS (blob data) + IndexedDB (metadĂˇta)</li>
          <li>Nastavenia emulĂˇtora a ovlĂˇdania â€” v IndexedDB</li>
          <li>BIOS sĂşbory â€” v OPFS (nikdy sa neposielajĂş na server)</li>
          <li>Google OAuth token (ak pouĹľĂ­vate Drive Picker) â€” v sessionStorage (zmizne pri zatvorenĂ­ karty)</li>
        </ul>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          VoliteÄľnĂ˝ Supabase ĂşÄŤet
        </h2>
        <p>
          Ak sa prihlĂˇsite do voliteÄľnĂ©ho ĂşÄŤtu (Supabase), synchronizujĂş sa
          medzi vaĹˇimi zariadeniami iba:
        </p>
        <ul className="list-disc pl-5 space-y-1">
          <li>MetadĂˇta hier (nie samotnĂ© ROM/ISO)</li>
          <li>Nastavenia emulĂˇtora a ovlĂˇdania</li>
          <li>MetadĂˇta save states (nie samotnĂ© sĂşbory)</li>
          <li>HistĂłria hrania</li>
        </ul>
        <p>
          Supabase ĂşÄŤet je voliteÄľnĂ˝. AplikĂˇcia plne funguje bez neho.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Google Drive
        </h2>
        <p>
          Ak pouĹľijete Google Drive Picker, Jaňo še chce bavkac vyĹľiada o najmenĹˇĂ­
          moĹľnĂ˝ rozsah oprĂˇvnenĂ­ (<code>drive.file</code>) â€” prĂ­stup iba k
          sĂşborom, ktorĂ© v Picker-i vyberiete.
        </p>
        <p>
          OAuth token sa ukladĂˇ iba v sessionStorage a po zatvorenĂ­ karty
          zmizne. Jaňo še chce bavkac nikdy neukladĂˇ token do localStorage ani na server.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Diagnostika
        </h2>
        <p>
          DiagnostickĂˇ strĂˇnka zbiera informĂˇcie o vaĹˇom prehliadaÄŤi (typ,
          verzia, podporovanĂ© API) za ĂşÄŤelom rieĹˇenia problĂ©mov. Tieto dĂˇta
          sa zobrazia iba vĂˇm a mĂ´Ĺľete ich skopĂ­rovaĹĄ do schrĂˇnky. Nikdy sa
          automaticky neodosielajĂş.
        </p>
        <p>
          Report neobsahuje tokeny, heslĂˇ, BIOS obsah ani nĂˇzvy vaĹˇich
          sĂşkromnĂ˝ch Google Drive sĂşborov.
        </p>
      </Card>

      <Card className="p-4 space-y-3 text-sm leading-relaxed">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Cookies a sledovanie
        </h2>
        <p>
          Jaňo še chce bavkac nepouĹľĂ­va reklamnĂ© cookies ani sledovacie sluĹľby
          tretĂ­ch strĂˇn (Google Analytics, Facebook Pixel atÄŹ.).
        </p>
      </Card>
    </div>
  );
}
