"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Save, Download, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SaveStateRecord, GameRecord } from "@/types/game";
import { formatBytes } from "@/components/pwa/storage-meter";

export default function SavesPage() {
  const [saves, setSaves] = useState<Array<SaveStateRecord & { gameName?: string }>>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    import("@/lib/storage/repositories")
      .then(async ({ getAllGames, getSaveStates }) => {
        const games = await getAllGames();
        const all = await Promise.all(
          games.map(async (g) => {
            const s = await getSaveStates(g.id);
            return s.map((state) => ({ ...state, gameName: g.name }));
          })
        );
        setSaves(all.flat().sort((a, b) => b.updatedAt - a.updatedAt));
      })
      .catch(() => {});
  }, []);

  const filtered = saves.filter((s) =>
    s.gameName?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    const { deleteSaveState } = await import("@/lib/storage/repositories");
    await deleteSaveState(id);
    setSaves((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-lg text-primary">Save States</h1>
      </div>

      <Card className="p-3">
        <Input
          placeholder="Hľadať podľa názvu hry…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Save className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Žiadne uložené pozície. Uložte si pozíciu počas hrania cez tlačidlo Save.
          </p>
        </Card>
      ) : (
        <Card className="divide-y divide-border">
          {filtered.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.gameName}</p>
                <p className="text-xs text-muted-foreground">
                  Slot {s.slot}
                  {s.isAutoSave && <span className="ml-2 text-primary">Auto</span>}
                  {" · "}
                  {new Date(s.updatedAt).toLocaleString("sk")}
                  {" · "}
                  {formatBytes(s.fileSize)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {s.emulatorCore} {s.emulatorVersion}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <Link href={`/play/${s.gameId}?slot=${s.slot}`}>
                  <Download className="h-3 w-3 mr-1" />
                  Načítať
                </Link>
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleDelete(s.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
