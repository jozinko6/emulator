"use client";

/**
 * GameCard — karta hry v knižnici (grid view).
 *
 * Per prompt ETAPA 9. Zobrazí obal, názov, platformu, čas hrania.
 * Klik na kartu otvorí detail hry.
 *
 * Komentáre v slovenčine.
 */
import Link from "next/link";
import { Clock, Heart, Gamepad2 } from "lucide-react";
import type { GameRecord } from "@/types/game";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  formatPlayTime,
  formatRelativeTime,
  platformLabel,
  platformColorClass,
} from "@/lib/format";

interface GameCardProps {
  game: GameRecord;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link href={`/game/${game.id}`} className="block no-underline" aria-label={`Detail hry ${game.name}`}>
      <Card className="group h-full gap-0 overflow-hidden p-0 transition-all hover:ring-2 hover:ring-primary/40 hover:shadow-lg hover:shadow-primary/5">
        {/* Cover */}
        <div className="relative aspect-[3/4] w-full overflow-hidden bg-secondary/60">
          {game.coverUrl ? (
             
            <img
              src={game.coverUrl}
              alt={`Obal hry ${game.name}`}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Gamepad2 className="size-10 opacity-50" aria-hidden="true" />
            </div>
          )}
          {/* Favorite badge */}
          {game.isFavorite && (
            <div className="absolute right-2 top-2 rounded-full bg-background/80 p-1 backdrop-blur">
              <Heart className="size-4 fill-primary text-primary" aria-hidden="true" />
            </div>
          )}
          {/* Platform badge */}
          <div className="absolute bottom-2 left-2">
            <Badge
              variant="secondary"
              className={`${platformColorClass(game.platform)} bg-background/80 backdrop-blur`}
            >
              {platformLabel(game.platform)}
            </Badge>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-1 p-3">
          <p className="line-clamp-1 font-medium text-foreground" title={game.name}>
            {game.name}
          </p>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" aria-hidden="true" />
              {formatPlayTime(game.totalPlayTimeSeconds)}
            </span>
            <span>{formatRelativeTime(game.lastPlayedAt)}</span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
