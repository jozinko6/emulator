"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Heart,
  Trash2,
  Pencil,
  Settings,
  Download,
  Clock,
  HardDrive,
  Calendar,
  FileText,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { GameRecord, SaveStateRecord } from "@/types/game";
import { formatBytes } from "@/components/pwa/storage-meter";

const PLATFORM_LABEL = { dos: "DOS", ps1: "PlayStation", ps2: "PlayStation 2" };
const PLATFORM_COLOR = {
  dos: "text-amber-400",
  ps1: "text-emerald-400",
  ps2: "text-fuchsia-400",
};

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [game, setGame] = useState<GameRecord | null>(null);
  const [saves, setSaves] = useState<SaveStateRecord[]>([]);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");

  useEffect(() => {
    import("@/lib/storage/repositories")
      .then(async ({ getGame, getSaveStates }) => {
        const g = await getGame(id);
        setGame(g ?? null);
        setNameValue(g?.name ?? "");
        const s = await getSaveStates(id);
        setSaves(s.sort((a, b) => b.updatedAt - a.updatedAt));
      })
      .catch(() => {});
  }, [id]);

  if (!game) {
    return (
      <div className="container mx-auto px-4 py-6 max-w-3xl">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted-foreground">Hra sa nenaĹˇla.</p>
          <Button asChild variant="outline" className="mt-3">
            <Link href="/library">
              <ArrowLeft className="h-4 w-4 mr-2" />
              SpĂ¤ĹĄ na kniĹľnicu
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  const handleDelete = async () => {
    const { deleteGame } = await import("@/lib/storage/repositories");
    const { deleteRecursive } = await import("@/lib/storage/opfs");
    await deleteGame(game.id);
    await deleteRecursive(`games/${game.id}`);
    // Also remove save states from OPFS
    await deleteRecursive(`saves/${game.id}`);
    router.push("/library");
  };

  const handleDeleteSaves = async () => {
    const { deleteSaveState } = await import("@/lib/storage/repositories");
    const { deleteRecursive } = await import("@/lib/storage/opfs");
    await Promise.all(saves.map((s) => deleteSaveState(s.id)));
    await deleteRecursive(`saves/${game.id}`);
    setSaves([]);
  };

  const handleRename = async () => {
    if (!nameValue.trim()) return;
    const { putGame } = await import("@/lib/storage/repositories");
    const updated = { ...game, name: nameValue.trim(), updatedAt: Date.now() };
    await putGame(updated);
    setGame(updated);
    setEditingName(false);
  };

  const toggleFavorite = async () => {
    const { putGame } = await import("@/lib/storage/repositories");
    const updated = { ...game, isFavorite: !game.isFavorite, updatedAt: Date.now() };
    await putGame(updated);
    setGame(updated);
  };

  const hasSave = saves.length > 0;

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link href="/library">
          <ArrowLeft className="h-4 w-4 mr-1" />
          SpĂ¤ĹĄ
        </Link>
      </Button>

      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-24 h-32 rounded-md bg-gradient-to-br from-primary/10 to-fuchsia-500/5 flex items-center justify-center shrink-0">
            {game.coverUrl ? (
               
              <img src={game.coverUrl} alt={game.name} className="w-full h-full object-cover rounded-md" />
            ) : (
              <Play className="h-8 w-8 text-primary/30" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={PLATFORM_COLOR[game.platform]}>
                {PLATFORM_LABEL[game.platform]}
              </Badge>
              {game.isFavorite && (
                <Badge variant="outline" className="text-amber-400 border-amber-500/30">
                  <Heart className="h-3 w-3 mr-1" /> ObÄľĂşbenĂ©
                </Badge>
              )}
              <Badge variant="outline">
                {game.compatibilityStatus === "unknown" ? "NeznĂˇma kompatibilita" : game.compatibilityStatus}
              </Badge>
            </div>

            {editingName ? (
              <div className="flex gap-2">
                <Input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  className="text-xl font-semibold"
                />
                <Button size="sm" onClick={handleRename}>UloĹľiĹĄ</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>ZruĹˇiĹĄ</Button>
              </div>
            ) : (
              <h1 className="text-2xl font-semibold">{game.name}</h1>
            )}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs text-muted-foreground pt-2">
              <div className="flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatBytes(game.size)}
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span className="truncate">{game.mainFile}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(game.createdAt).toLocaleDateString("sk")}
              </div>
              {game.lastPlayedAt && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {new Date(game.lastPlayedAt).toLocaleDateString("sk")}
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatPlayTime(game.totalPlayTimeSeconds)}
              </div>
              <div className="flex items-center gap-1">
                <Settings className="h-3 w-3" />
                {game.emulatorVersion}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
          <Button asChild>
            <Link href={`/play/${game.id}`}>
              <Play className="h-4 w-4 mr-2" />
              {hasSave ? "Pokračovať" : "Hrať"}
            </Link>
          </Button>
          {hasSave && (
            <Button asChild variant="outline">
              <Link href={`/play/${game.id}?fresh=1`}>
                <Play className="h-4 w-4 mr-2" />
                Hrať od začiatku
              </Link>
            </Button>
          )}
          <Button variant="outline" onClick={toggleFavorite}>
            <Heart className={`h-4 w-4 mr-2 ${game.isFavorite ? "fill-amber-400 text-amber-400" : ""}`} />
            {game.isFavorite ? "OdstrĂˇniĹĄ z obÄľĂşbenĂ˝ch" : "PridaĹĄ do obÄľĂşbenĂ˝ch"}
          </Button>
          <Button variant="outline" onClick={() => setEditingName(!editingName)}>
            <Pencil className="h-4 w-4 mr-2" />
            PremenovaĹĄ
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline">
                <Trash2 className="h-4 w-4 mr-2" />
                OdstrĂˇniĹĄ save states
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>OdstrĂˇniĹĄ vĹˇetky save states?</AlertDialogTitle>
                <AlertDialogDescription>
                  TĂˇto akcia odstrĂˇni vĹˇetky uloĹľenĂ© pozĂ­cie pre tĂşto hru. SamotnĂˇ hra zostane v kniĹľnici.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ZruĹˇiĹĄ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDeleteSaves}>
                  OdstrĂˇniĹĄ
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                OdstrĂˇniĹĄ hru
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>OdstrĂˇniĹĄ hru?</AlertDialogTitle>
                <AlertDialogDescription>
                  TĂˇto akcia natrvalo odstrĂˇni hru, vĹˇetky jej sĂşbory z OPFS a vĹˇetky save states.
                  Akciu nemoĹľno vrĂˇtiĹĄ spĂ¤ĹĄ.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ZruĹˇiĹĄ</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>
                  OdstrĂˇniĹĄ
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      {/* Save states */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm uppercase tracking-widest text-muted-foreground">
            Save States ({saves.length})
          </h2>
        </div>
        {saves.length === 0 ? (
          <p className="text-xs text-muted-foreground">Ĺ˝iadne uloĹľenĂ© pozĂ­cie.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {saves.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 p-2 rounded border border-border bg-card/50"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">
                    Slot {s.slot}
                    {s.isAutoSave && (
                      <span className="ml-2 text-[10px] text-primary">Auto</span>
                    )}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(s.updatedAt).toLocaleString("sk")} Â· {formatBytes(s.fileSize)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {s.emulatorCore} {s.emulatorVersion}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link href={`/play/${game.id}?slot=${s.slot}`}>
                    <Download className="h-3 w-3 mr-1" />
                    NaÄŤĂ­taĹĄ
                  </Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Legal reminder */}
      <Card className="p-3 bg-card/30">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground">
            Jaňo še chce bavkac neukladĂˇ ani neposkytuje komerÄŤnĂ© hry. PouĹľĂ­vateÄľ zodpovedĂˇ za
            vlastnĂ© sĂşbory. Hra zostĂˇva v lokĂˇlnom ĂşloĹľisku vĂˇĹˇho zariadenia.
          </p>
        </div>
      </Card>
    </div>
  );
}

import Link from "next/link";

function formatPlayTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}min`;
}
