"use client";

/**
 * FilterBar — vyhľadávanie + filtre + triedenie pre knižnicu.
 *
 * Per prompt ETAPA 9. Používa `useLibraryStore`.
 *
 * Komentáre v slovenčine.
 */
import { Search, ArrowDownUp, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLibraryStore } from "@/stores/library-store";
import { isPs2Available } from "@/emulators/ps2/ps2-availability";

interface FilterBarProps {
  view: "grid" | "list";
  onViewChange: (v: "grid" | "list") => void;
}

export function FilterBar({ view, onViewChange }: FilterBarProps) {
  const {
    searchQuery,
    setSearchQuery,
    platformFilter,
    setPlatformFilter,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
  } = useLibraryStore();

  const ps2Enabled = isPs2Available();

  return (
    <div className="space-y-3">
      {/* Search + view toggle */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hľadať v knižnici…"
            aria-label="Hľadať v knižnici"
            className="h-11 pl-9"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <Button
            type="button"
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Zobraziť ako mriežku"
            aria-pressed={view === "grid"}
            onClick={() => onViewChange("grid")}
            className="h-9"
          >
            <LayoutGrid className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            aria-label="Zobraziť ako zoznam"
            aria-pressed={view === "list"}
            onClick={() => onViewChange("list")}
            className="h-9"
          >
            <List className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={platformFilter}
          onValueChange={(v) => setPlatformFilter(v as typeof platformFilter)}
        >
          <SelectTrigger className="h-10 w-[160px]" aria-label="Filter platformy">
            <SelectValue placeholder="Platforma" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Všetky platformy</SelectItem>
            <SelectItem value="dos">DOS</SelectItem>
            <SelectItem value="ps1">PlayStation</SelectItem>
            <SelectItem value="ps2" disabled={!ps2Enabled}>
              PlayStation 2 {!ps2Enabled ? "(vypnuté)" : ""}
            </SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as typeof sortBy)}
        >
          <SelectTrigger className="h-10 w-[170px]" aria-label="Triediť podľa">
            <SelectValue placeholder="Triediť" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Dátum pridania</SelectItem>
            <SelectItem value="lastPlayedAt">Posledné hranie</SelectItem>
            <SelectItem value="name">Názov</SelectItem>
            <SelectItem value="size">Veľkosť</SelectItem>
            <SelectItem value="isFavorite">Obľúbené</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10"
          onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
          aria-label={`Zmeniť smer triedenia — aktuálne ${sortDir === "asc" ? "vzostupne" : "zostupne"}`}
        >
          <ArrowDownUp
            className={`size-4 transition-transform ${sortDir === "asc" ? "" : "rotate-180"}`}
            aria-hidden="true"
          />
          {sortDir === "asc" ? "Vzostupne" : "Zostupne"}
        </Button>
      </div>
    </div>
  );
}
