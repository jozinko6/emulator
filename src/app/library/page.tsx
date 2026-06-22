"use client";

import { useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, LayoutGrid, List, Upload, Gamepad2 } from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { EmulatorPlatform } from "@/types/emulator";

const PLATFORM_LABEL: Record<EmulatorPlatform | "all", string> = {
  all: "Všetky",
  dos: "DOS",
  ps1: "PlayStation",
  ps2: "PlayStation 2",
};

const PLATFORM_COLOR: Record<EmulatorPlatform, string> = {
  dos: "text-amber-400",
  ps1: "text-emerald-400",
  ps2: "text-fuchsia-400",
};

export default function LibraryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Načítavam knižnicu…</div>}>
      <LibraryContent />
    </Suspense>
  );
}

function LibraryContent() {
  const params = useSearchParams();
  const initialPlatform = (params?.get("platform") as EmulatorPlatform | "all" | null) ?? "all";

  const {
    searchQuery,
    platformFilter,
    sortBy,
    sortDir,
    setSearchQuery,
    setPlatformFilter,
    setSortBy,
    setSortDir,
    filtered,
    games,
  } = useLibraryStore();

  const [view, setView] = useViewMode();

  useEffect(() => {
    if (initialPlatform && initialPlatform !== platformFilter) {
      setPlatformFilter(initialPlatform);
    }
     
  }, [initialPlatform]);

  const list = filtered();

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-lg text-primary">Knižnica</h1>
        <Button asChild size="sm">
          <Link href="/import">
            <Upload className="h-4 w-4 mr-1" />
            Import
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať hru…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={platformFilter}
            onValueChange={(v) => setPlatformFilter(v as typeof platformFilter)}
          >
            <SelectTrigger className="w-full md:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(PLATFORM_LABEL) as Array<EmulatorPlatform | "all">).map((p) => (
                <SelectItem key={p} value={p}>
                  {PLATFORM_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Názov</SelectItem>
              <SelectItem value="createdAt">Dátum pridania</SelectItem>
              <SelectItem value="lastPlayedAt">Posledné hranie</SelectItem>
              <SelectItem value="size">Veľkosť</SelectItem>
              <SelectItem value="isFavorite">Obľúbené</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            title={sortDir === "asc" ? "Vzostupne" : "Zostupne"}
          >
            {sortDir === "asc" ? "↑" : "↓"}
          </Button>
          <div className="flex gap-1 border border-border rounded-md p-0.5">
            <Button
              variant={view === "grid" ? "default" : "ghost"}
              size="icon"
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="icon"
              onClick={() => setView("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {list.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Gamepad2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            {games.length === 0
              ? "Knižnica je prázdna. Importujte prvú hru."
              : "Žiadne hry nezodpovedajú filtrom."}
          </p>
          <Button asChild>
            <Link href="/import">
              <Upload className="h-4 w-4 mr-2" />
              Importovať hru
            </Link>
          </Button>
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {list.map((g) => (
            <Link key={g.id} href={`/game/${g.id}`} className="group no-underline">
              <Card className="overflow-hidden bg-card hover:ring-1 hover:ring-primary/40 transition-all h-full">
                <div className="aspect-[3/4] bg-gradient-to-br from-primary/10 to-fuchsia-500/5 flex items-center justify-center">
                  {g.coverUrl ? (
                     
                    <img src={g.coverUrl} alt={g.name} className="w-full h-full object-cover" />
                  ) : (
                    <Gamepad2 className="h-8 w-8 text-primary/30" />
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{g.name}</p>
                  <p className={`text-[10px] ${PLATFORM_COLOR[g.platform]}`}>
                    {PLATFORM_LABEL[g.platform]}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-border">
          {list.map((g) => (
            <Link
              key={g.id}
              href={`/game/${g.id}`}
              className="flex items-center gap-3 p-3 hover:bg-secondary/30 no-underline"
            >
              <div className="w-10 h-10 rounded bg-gradient-to-br from-primary/10 to-fuchsia-500/5 flex items-center justify-center shrink-0">
                {g.coverUrl ? (
                   
                  <img src={g.coverUrl} alt="" className="w-full h-full object-cover rounded" />
                ) : (
                  <Gamepad2 className="h-5 w-5 text-primary/40" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className={`text-[11px] ${PLATFORM_COLOR[g.platform]}`}>
                  {PLATFORM_LABEL[g.platform]} · {formatBytes(g.size)}
                </p>
              </div>
              {g.isFavorite && <span className="text-amber-400 text-xs">★</span>}
              {g.lastPlayedAt && (
                <span className="text-[10px] text-muted-foreground">
                  {new Date(g.lastPlayedAt).toLocaleDateString("sk")}
                </span>
              )}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// Simple view mode hook with localStorage persistence
import { useState } from "react";
function useViewMode(): ["grid" | "list", (v: "grid" | "list") => void] {
  const [view, setView] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("rc_library_view") as "grid" | "list") ?? "grid";
  });
  const set = (v: "grid" | "list") => {
    setView(v);
    try {
      localStorage.setItem("rc_library_view", v);
    } catch {}
  };
  return [view, set];
}
