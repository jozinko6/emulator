"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settings-store";
import { StorageMeter } from "@/components/pwa/storage-meter";
import { BiosManager } from "@/components/storage/bios-manager";
import type { EmulatorPlatform } from "@/types/emulator";
import type { AspectRatio, PerformanceProfile } from "@/types/game";

const PLATFORMS: EmulatorPlatform[] = ["dos", "ps1", "ps2"];

export default function SettingsPage() {
  const {
    platformSettings,
    setPlatformSetting,
    setPreference,
    preferences,
  } = useSettingsStore();

  const [activePlatform, setActivePlatform] = useState<EmulatorPlatform>("dos");
  const [deadzone, setDeadzone] = useState(0.15);
  const [sensitivity, setSensitivity] = useState(1.0);

  const ps2Enabled = process.env.NEXT_PUBLIC_ENABLE_PS2 === "true";

  const current = platformSettings[activePlatform];

  const handleSet = (patch: Partial<NonNullable<typeof current>>) => {
    if (!current) return;
    setPlatformSetting(activePlatform, patch);
    // persist
    import("@/lib/storage/repositories")
      .then(({ putEmulatorSettings }) =>
        putEmulatorSettings({
          ...current,
          ...patch,
          platform: activePlatform,
          updatedAt: Date.now(),
        })
      )
      .catch(() => {});
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Nastavenia</h1>

      {/* Platform selector */}
      <Card className="p-3">
        <Label className="text-xs text-muted-foreground">Platforma</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              variant={activePlatform === p ? "default" : "outline"}
              onClick={() => setActivePlatform(p)}
              disabled={p === "ps2" && !ps2Enabled}
              className="text-xs"
            >
              {p === "dos" ? "DOS" : p === "ps1" ? "PlayStation" : "PS2"}
              {p === "ps2" && !ps2Enabled && (
                <span className="ml-1 text-[10px] opacity-60">(vypnuté)</span>
              )}
            </Button>
          ))}
        </div>
      </Card>

      {/* Emulator settings */}
      {current && (
        <Card className="p-4 space-y-4">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Emulátor
          </h2>

          <div className="space-y-2">
            <Label>Hlasitosť: {Math.round(current.volume * 100)}%</Label>
            <Slider
              value={[current.volume]}
              onValueChange={(v) => handleSet({ volume: v[0] ?? 0 })}
              min={0}
              max={1}
              step={0.05}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Stlmiť</Label>
            <Switch
              checked={current.muted}
              onCheckedChange={(v) => handleSet({ muted: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Pomer strán</Label>
            <Select
              value={current.aspectRatio}
              onValueChange={(v) => handleSet({ aspectRatio: v as AspectRatio })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="native">Pôvodný</SelectItem>
                <SelectItem value="4:3">4:3</SelectItem>
                <SelectItem value="16:9">16:9</SelectItem>
                <SelectItem value="stretch">Roztiahnuť</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Výkonový profil</Label>
            <Select
              value={current.performanceProfile}
              onValueChange={(v) =>
                handleSet({ performanceProfile: v as PerformanceProfile })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="performance">Výkon</SelectItem>
                <SelectItem value="balanced">Vyvážené</SelectItem>
                <SelectItem value="quality">Kvalita</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-save pri ukončení</Label>
              <p className="text-[10px] text-muted-foreground">
                Automaticky uloží pozíciu do Slot 0 pri ukončení hry.
              </p>
            </div>
            <Switch
              checked={current.autoSave}
              onCheckedChange={(v) => handleSet({ autoSave: v })}
            />
          </div>
        </Card>
      )}

      {/* Controller settings */}
      <Card className="p-4 space-y-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Ovládanie
        </h2>

        <div className="space-y-2">
          <Label>Gamepad deadzone: {deadzone.toFixed(2)}</Label>
          <Slider
            value={[deadzone]}
            onValueChange={(v) => {
              const dz = v[0] ?? 0.15;
              setDeadzone(dz);
              setPreference("controller.deadzone", dz);
              import("@/lib/storage/repositories")
                .then(({ putUserPreference }) =>
                  putUserPreference({
                    key: "controller.deadzone",
                    value: dz,
                    updatedAt: Date.now(),
                  })
                )
                .catch(() => {});
            }}
            min={0}
            max={0.5}
            step={0.01}
          />
          <p className="text-[10px] text-muted-foreground">
            Tichá zóna pre analógové osi — ignorujú sa malé odchýlky.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Citlivosť: {sensitivity.toFixed(2)}x</Label>
          <Slider
            value={[sensitivity]}
            onValueChange={(v) => {
              const s = v[0] ?? 1.0;
              setSensitivity(s);
              setPreference("controller.sensitivity", s);
              import("@/lib/storage/repositories")
                .then(({ putUserPreference }) =>
                  putUserPreference({
                    key: "controller.sensitivity",
                    value: s,
                    updatedAt: Date.now(),
                  })
                )
                .catch(() => {});
            }}
            min={0.5}
            max={2}
            step={0.05}
          />
        </div>
      </Card>

      {/* BIOS manager */}
      <Card className="p-4 space-y-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          BIOS
        </h2>
        <BiosManager />
      </Card>

      {/* Storage */}
      <Card className="p-4 space-y-3">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Úložisko
        </h2>
        <StorageMeter />
        <Button
          variant="outline"
          onClick={() =>
            import("@/lib/storage/opfs")
              .then(({ requestPersistentStorage }) => requestPersistentStorage())
              .then((ok) =>
                alert(
                  ok
                    ? "Perzistentné úložisko bolo povolené."
                    : "Prehliadač zamietol požiadavku."
                )
              )
          }
        >
          Požiadať o perzistentné úložisko
        </Button>
      </Card>

      {/* PS2 status */}
      <Card className="p-4 space-y-2">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          PlayStation 2
        </h2>
        <div className="flex items-center justify-between text-sm">
          <span>Stav:</span>
          <span className={ps2Enabled ? "text-amber-400" : "text-muted-foreground"}>
            {ps2Enabled ? "Experimentálne (NEXT_PUBLIC_ENABLE_PS2=true)" : "Vypnuté (false)"}
          </span>
        </div>
        {!ps2Enabled && (
          <p className="text-xs text-muted-foreground">
            PS2 emulácia je experimentálna a v predvolenom zostavení vypnutá.
            Aktivuje sa len po reálnej integrácii Play!.js jadra.
          </p>
        )}
      </Card>
    </div>
  );
}
