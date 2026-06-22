/**
 * PS2 availability — feature flag detection.
 *
 * Per prompt ETAPA 10: PS2 je za feature flagom `NEXT_PUBLIC_ENABLE_PS2`.
 * Ak je flag false (default), `isPs2Available()` vráti false a `createAdapter("ps2")`
 * vyhodí `RetroCloudError(EMULATOR_CORE_UNAVAILABLE)`.
 *
 * Nikdy nepredstierame PS2 emuláciu — žiadne placeholdery.
 *
 * Komentáre v slovenčine.
 */

/**
 * Skontroluje, či je PS2 emulácia dostupná v tomto zostavení.
 *
 * Next.js injektuje env premenné s prefixom `NEXT_PUBLIC_` do client bundle
 * cez `process.env.NEXT_PUBLIC_*`. Hodnota je vždy reťazec alebo undefined.
 */
export function isPs2Available(): boolean {
  // V Next.js 16 je `process.env.NEXT_PUBLIC_*` nahradené build-time hodnotou.
  // Bezpečný prístup — môže byť undefined v testovacom prostredí.
  const flag = process.env.NEXT_PUBLIC_ENABLE_PS2;
  return flag === "true";
}

/**
 * Vráti dôvod, prečo PS2 nie je dostupné (pre zobrazenie v UI).
 */
export function getPs2UnavailableReason(): string {
  return "PS2 emulačné jadro (Play!.js) je experimentálne a v predvolenom zostavení vypnuté. " +
    "Pre aktiváciu nastavte NEXT_PUBLIC_ENABLE_PS2=true a poskytnite PS2 WASM jadro.";
}
