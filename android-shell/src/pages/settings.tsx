import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings-store";
import { BiosManager } from "@/components/storage/bios-manager";
import { StorageMeter } from "@shell/components/storage-meter";
import type { EmulatorPlatform } from "@/types/emulator";

const PLATFORMS: EmulatorPlatform[] = ["dos", "ps1", "ps2"];

export function SettingsPage() {
  const { platformSettings, setPlatformSetting } = useSettingsStore();
  const [activePlatform, setActivePlatform] = useState<EmulatorPlatform>("dos");
  const [deadzone, setDeadzone] = useState(0.15);

  const current = platformSettings[activePlatform];

  const handleSet = (patch: Partial<NonNullable<typeof current>>) => {
    if (!current) return;
    setPlatformSetting(activePlatform, patch);
    import("@/lib/storage/repositories")
      .then(({ putEmulatorSettings }) =>
        putEmulatorSettings({
          ...current,
          ...patch,
          platform: activePlatform,
          updatedAt: Date.now(),
        })
      )
      .catch((e) => console.warn("Failed to persist settings:", e));
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl space-y-4">
      <h1 className="font-display text-lg text-primary">Nastavenia</h1>

      <Card className="p-3">
        <Label className="text-xs text-muted-foreground">Platforma</Label>
        <div className="grid grid-cols-3 gap-2 mt-2">
          {PLATFORMS.map((p) => (
            <Button
              key={p}
              variant={activePlatform === p ? "default" : "outline"}
              onClick={() => setActivePlatform(p)}
              disabled={p === "ps2"}
              className="text-xs"
            >
              {p === "dos" ? "DOS" : p === "ps1" ? "PlayStation" : "PS2 (vypnuté)"}
            </Button>
          ))}
        </div>
      </Card>

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
            <Switch checked={current.muted} onCheckedChange={(v) => handleSet({ muted: v })} />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Auto-save pri ukončení</Label>
              <p className="text-[10px] text-muted-foreground">
                Automaticky uloží pozíciu do Auto-save slotu.
              </p>
            </div>
            <Switch checked={current.autoSave} onCheckedChange={(v) => handleSet({ autoSave: v })} />
          </div>
        </Card>
      )}

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          Ovládanie
        </h2>
        <div className="space-y-2">
          <Label>Gamepad deadzone: {deadzone.toFixed(2)}</Label>
          <Slider
            value={[deadzone]}
            onValueChange={(v) => setDeadzone(v[0] ?? 0.15)}
            min={0}
            max={0.5}
            step={0.01}
          />
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
          BIOS
        </h2>
        <BiosManager />
      </Card>

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
                alert(ok ? "Perzistentné úložisko bolo povolené." : "Prehliadač zamietol požiadavku.")
              )
          }
        >
          Požiadať o perzistentné úložisko
        </Button>
      </Card>
    </div>
  );
}
