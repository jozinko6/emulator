"use client";

/**
 * GamepadMapper — UI pre mapovanie fyzického gamepadu.
 *
 * Per prompt ETAPA 7. Poskytuje:
 *  - Zoznam pripojených ovládačov
 *  - Pre každý ovládač: zoznam tlačidiel + osí + current mapping
 *  - Možnosť remapovať stlačením tlačidla
 *
 * Komentáre v slovenčine.
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { Gamepad2, RefreshCw, Trash2, Loader2, Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  STANDARD_BUTTON_MAP,
  STANDARD_AXIS_MAP,
} from "@/emulators/core/emulator-input";

interface GamepadInfo {
  index: number;
  id: string;
  profile: string;
  buttonCount: number;
  axisCount: number;
}

/** Mappable targets — zoznam ovládacích prvkov, na ktoré je možné namapovať. */
const MAPPABLE_CONTROLS = [
  "face-a",
  "face-b",
  "face-x",
  "face-y",
  "l1",
  "r1",
  "l2",
  "r2",
  "select",
  "start",
  "l3",
  "r3",
  "dpad-up",
  "dpad-down",
  "dpad-left",
  "dpad-right",
  "lstick-x",
  "lstick-y",
  "rstick-x",
  "rstick-y",
];

interface MappingState {
  /** Map button index → control name. */
  buttons: Record<number, string>;
  /** Map axis index → control name. */
  axes: Record<number, string>;
}

interface GamepadMapperProps {
  /** Notifikácia pri zmene mapovania. */
  onMappingChange?: (gamepadIndex: number, mapping: MappingState) => void;
  /** Initial mapping per gamepad. */
  initialMapping?: Record<number, MappingState>;
}

export function GamepadMapper({ onMappingChange, initialMapping }: GamepadMapperProps) {
  const [gamepads, setGamepads] = useState<GamepadInfo[]>([]);
  const [selectedPad, setSelectedPad] = useState<number | null>(null);
  const [mappings, setMappings] = useState<Record<number, MappingState>>(initialMapping ?? {});
  const [listeningFor, setListeningFor] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);
  const { toast } = useToast();

  /**
   * Refresh zoznamu pripojených ovládačov.
   */
  const refreshGamepads = useCallback(() => {
    if (typeof navigator === "undefined" || !navigator.getGamepads) {
      setGamepads([]);
      return;
    }
    const pads = navigator.getGamepads();
    const list: GamepadInfo[] = [];
    if (pads) {
      for (const gp of pads) {
        if (gp) {
          list.push({
            index: gp.index,
            id: gp.id,
            profile: detectProfile(gp.id),
            buttonCount: gp.buttons.length,
            axisCount: gp.axes.length,
          });
        }
      }
    }
    setGamepads(list);
    if (list.length > 0 && selectedPad === null) {
      setSelectedPad(list[0].index);
    }
  }, [selectedPad]);

  // Initial scan + event listeners
  useEffect(() => {
    // Initial scan je legitímny use-case — potrebujeme zistiť pripojené
    // ovládače pri mounte komponentu. Event listenery reagujú na zmeny.
     
    refreshGamepads();
    const onConnect = () => refreshGamepads();
    const onDisconnect = () => refreshGamepads();
    window.addEventListener("gamepadconnected", onConnect);
    window.addEventListener("gamepaddisconnected", onDisconnect);
    return () => {
      window.removeEventListener("gamepadconnected", onConnect);
      window.removeEventListener("gamepaddisconnected", onDisconnect);
    };
  }, [refreshGamepads]);

  /**
   * Priradí button index k target controlu.
   *
   * Deklarovaná PRED useEffect, ktorý ju používa — React hooks pravidlá
   * vyžadujú, aby premenné použité v effecte boli deklarované pred ním.
   */
  const assignButton = useCallback(
    (padIndex: number, buttonIndex: number, control: string) => {
      setMappings((prev) => {
        const current = prev[padIndex] ?? { buttons: {}, axes: {} };
        const next: MappingState = {
          buttons: { ...current.buttons, [buttonIndex]: control },
          axes: current.axes,
        };
        // Odstráň rovnaké priradenie z iných buttonov/axis
        for (const k of Object.keys(next.buttons)) {
          if (Number(k) !== buttonIndex && next.buttons[Number(k)] === control) {
            delete next.buttons[Number(k)];
          }
        }
        for (const k of Object.keys(next.axes)) {
          if (next.axes[Number(k)] === control) {
            delete next.axes[Number(k)];
          }
        }
        const newMappings = { ...prev, [padIndex]: next };
        onMappingChange?.(padIndex, next);
        return newMappings;
      });
      toast({
        title: "Mapovanie aktualizované",
        description: `Tlačidlo ${buttonIndex} → ${control}`,
      });
    },
    [onMappingChange, toast]
  );

  /**
   * Priradí axis index k target controlu.
   */
  const assignAxis = useCallback(
    (padIndex: number, axisIndex: number, control: string) => {
      setMappings((prev) => {
        const current = prev[padIndex] ?? { buttons: {}, axes: {} };
        const next: MappingState = {
          buttons: current.buttons,
          axes: { ...current.axes, [axisIndex]: control },
        };
        for (const k of Object.keys(next.axes)) {
          if (Number(k) !== axisIndex && next.axes[Number(k)] === control) {
            delete next.axes[Number(k)];
          }
        }
        for (const k of Object.keys(next.buttons)) {
          if (next.buttons[Number(k)] === control) {
            delete next.buttons[Number(k)];
          }
        }
        const newMappings = { ...prev, [padIndex]: next };
        onMappingChange?.(padIndex, next);
        return newMappings;
      });
      toast({
        title: "Mapovanie aktualizované",
        description: `Os ${axisIndex} → ${control}`,
      });
    },
    [onMappingChange, toast]
  );

  // Pokračuj v pollingu, len ak je "listeningFor" aktívne — čakáme na stlačenie.
  useEffect(() => {
    if (listeningFor === null || selectedPad === null) {
      if (pollRef.current !== null) {
        cancelAnimationFrame(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    const tick = (): void => {
      if (typeof navigator === "undefined" || !navigator.getGamepads) return;
      const pads = navigator.getGamepads();
      const gp = pads?.[selectedPad];
      if (gp) {
        // Skontroluj buttons
        for (let i = 0; i < gp.buttons.length; i++) {
          if (gp.buttons[i].value > 0.5) {
            // Našli sme stlačené tlačidlo — priradíme k listeningFor
            assignButton(selectedPad, i, listeningFor);
            setListeningFor(null);
            return;
          }
        }
        // Skontroluj osí (len výrazná zmena)
        for (let i = 0; i < gp.axes.length; i++) {
          if (Math.abs(gp.axes[i]) > 0.5) {
            assignAxis(selectedPad, i, listeningFor);
            setListeningFor(null);
            return;
          }
        }
      }
      pollRef.current = requestAnimationFrame(tick);
    };
    pollRef.current = requestAnimationFrame(tick);

    return () => {
      if (pollRef.current !== null) {
        cancelAnimationFrame(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [listeningFor, selectedPad, assignButton, assignAxis]);

  /**
   * Reset mapovania pre daný gamepad na default.
   */
  const resetMapping = useCallback(
    (padIndex: number) => {
      setMappings((prev) => {
        const next = { ...prev };
        delete next[padIndex];
        onMappingChange?.(padIndex, { buttons: {}, axes: {} });
        return next;
      });
      toast({
        title: "Mapovanie resetované",
        description: `Ovládač ${padIndex}: default štandardné mapovanie`,
      });
    },
    [onMappingChange, toast]
  );

  const selectedPadInfo = gamepads.find((g) => g.index === selectedPad);
  const selectedMapping = selectedPad !== null ? mappings[selectedPad] : undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="size-5 text-primary" aria-hidden="true" />
          Mapovanie ovládača
        </CardTitle>
        <CardDescription>
          Pripojte fyzický gamepad a namapujte tlačidlá a osí na PS1/PS2/DOS ovládacie prvky.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pripojené ovládače */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Pripojené ovládače</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={refreshGamepads}
              aria-label="Obnoviť zoznam ovládačov"
            >
              <RefreshCw className="size-4" />
              Obnoviť
            </Button>
          </div>
          {gamepads.length === 0 ? (
            <div className="rounded-md border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Žiadne ovládače nie sú pripojené. Pripojte Bluetooth ovládač a kliknite na "Obnoviť".
            </div>
          ) : (
            <ul className="space-y-1.5">
              {gamepads.map((gp) => (
                <li key={gp.index}>
                  <button
                    type="button"
                    onClick={() => setSelectedPad(gp.index)}
                    className={`w-full rounded-md border p-3 text-left transition-colors ${
                      selectedPad === gp.index
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-secondary/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={gp.id}>
                          {gp.id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Index: {gp.index} · Profil: {gp.profile} · Tlačidlá: {gp.buttonCount} · Osi: {gp.axisCount}
                        </p>
                      </div>
                      {selectedPad === gp.index && (
                        <Badge variant="default" className="shrink-0">Vybrané</Badge>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Mapovanie pre vybraný ovládač */}
        {selectedPadInfo && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Mapovanie pre: <span className="text-muted-foreground">{selectedPadInfo.id}</span>
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => resetMapping(selectedPadInfo.index)}
              >
                <Trash2 className="size-4" />
                Reset
              </Button>
            </div>

            <ScrollArea className="max-h-96 rounded-md border border-border">
              <div className="divide-y divide-border">
                {MAPPABLE_CONTROLS.map((control) => {
                  const currentMapping = findControlMapping(selectedMapping, control);
                  const isListening = listeningFor === control;
                  return (
                    <div
                      key={control}
                      className="flex items-center justify-between gap-3 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                          {control}
                        </code>
                        {currentMapping ? (
                          <Badge variant="secondary" className="text-xs">
                            {currentMapping}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            <Keyboard className="inline size-3 mr-1" />
                            default
                          </span>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isListening ? "default" : "outline"}
                        onClick={() => setListeningFor(isListening ? null : control)}
                        disabled={listeningFor !== null && !isListening}
                        className="min-h-9"
                      >
                        {isListening ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin" />
                            Stlačte tlačidlo…
                          </>
                        ) : (
                          "Remapovať"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            <p className="text-xs text-muted-foreground">
              <strong className="text-foreground">Poznámka:</strong> Ak neurčíte vlastné
              mapovanie, použije sa štandardné W3C Gamepad API mapovanie (Xbox layout).
              Pre PS1/PS2 adaptéry sa tlačidlá mapujú na EJS controller IDs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Skontroluje, či je daný control už namapovaný na nejaké tlačidlo/os.
 */
function findControlMapping(
  mapping: MappingState | undefined,
  control: string
): string | null {
  if (!mapping) return null;
  // Skontroluj buttons
  for (const [k, v] of Object.entries(mapping.buttons)) {
    if (v === control) return `Tlačidlo ${k}`;
  }
  // Skontroluj axes
  for (const [k, v] of Object.entries(mapping.axes)) {
    if (v === control) return `Os ${k}`;
  }
  return null;
}

/**
 * Detect gamepad profile (rovnaká logika ako v `emulator-input.ts`, ale
 * nechávame nezávislé kvôli UI import cyklám).
 */
function detectProfile(id: string): string {
  const lower = id.toLowerCase();
  if (lower.includes("dualsense")) return "DualSense";
  if (lower.includes("dualshock")) return "DualShock";
  if (lower.includes("xbox") || lower.includes("xinput")) return "Xbox";
  return "Generic";
}

/**
 * Re-export STANDARD_BUTTON_MAP a STANDARD_AXIS_MAP — pre UI komponenty,
 * ktoré chcú zobraziť default mapovanie.
 */
export { STANDARD_BUTTON_MAP, STANDARD_AXIS_MAP };
