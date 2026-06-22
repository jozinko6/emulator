"use client";

/**
 * GameListItem — riadkový layout hry v knižnici (list view).
 *
 * Per prompt ETAPA 9. Zobrazí malý obal, názov, platformu, veľkosť, čas hrania,
 * posledné hranie. Klik na riadok otvorí detail hry.
 *
 * Komentáre v slovenčine.
 */
import Link from "next/link";
import { Clock, Heart, Gamepad2, HardDrive } from "lucide-react";
import type { GameRecord } from "@/types/game";
import { Badge } from "@/components/ui/badge";
import {
  formatBytes,
  formatPlayTime,
  formatRelativeTime,
  platformLabel,
  platformColorClass,
} from "@/lib/format";

interface GameListItemProps {
  game: GameRecord;
}

export function GameListItem({ game }: GameListItemProps) {
  return (
    <Link
      href={`/game/${game.id}`}
      className="flex items-center gap-3 rounded-md border border-border bg-card p-3 no-underline transition-colors hover:bg-accent/30"
      aria-label={`Detail hry ${game.name}`}
    >
      {/* Thumbnail */}
      <div className="size-12 shrink-0 overflow-hidden rounded-md bg-secondary">
        {game.coverUrl ? (
           
          <img
            src={game.coverUrl}
            alt=""
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Gamepad2 className="size-5 opacity-60" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Name + meta */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground" title={game.name}>
            {game.name}
          </p>
          {game.isFavorite && (
            <Heart className="size-3.5 shrink-0 fill-primary text-primary" aria-hidden="true" />
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
          <Badge
            variant="outline"
            className={`${platformColorClass(game.platform)} px-1.5 py-0`}
          >
            {platformLabel(game.platform)}
          </Badge>
          <span className="flex items-center gap-1">
            <Clock className="size-3" aria-hidden="true" />
            {formatPlayTime(game.totalPlayTimeSeconds)}
          </span>
          <span className="flex items-center gap-1">
            <HardDrive className="size-3" aria-hidden="true" />
            {formatBytes(game.size)}
          </span>
          <span>{formatRelativeTime(game.lastPlayedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
