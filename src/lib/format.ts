/**
 * Format helpers — formátovanie veľkostí, času a dátumov.
 * Komentáre v slovenčine.
 */

/** Skonvertuje bytes na ľudsky čitateľný reťazec (B, KB, MB, GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 10 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(gb < 10 ? 1 : 0)} GB`;
}

/** Skonvertuje sekundy na "1h 23m 45s" alebo "23m 45s". */
export function formatPlayTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Skráti veľmi dlhé dátumy na "dnes", "včera", "pred 3 dňami", alebo dátum. */
export function formatRelativeTime(timestamp: number | undefined): string {
  if (!timestamp) return "nikdy";
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "pred chvíľou";
  if (diff < 3_600_000) return `pred ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `pred ${Math.floor(diff / 3_600_000)} h`;
  if (diff < 2 * 86_400_000) return "včera";
  if (diff < 7 * 86_400_000) return `pred ${Math.floor(diff / 86_400_000)} dňami`;
  return new Date(timestamp).toLocaleDateString("sk-SK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formátuje dátum ako "12. 3. 2024 14:30". */
export function formatDateTime(timestamp: number | undefined): string {
  if (!timestamp) return "—";
  return new Date(timestamp).toLocaleString("sk-SK", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Slovenský názov platformy. */
export function platformLabel(platform: string): string {
  switch (platform) {
    case "dos":
      return "DOS";
    case "ps1":
      return "PlayStation";
    case "ps2":
      return "PlayStation 2";
    default:
      return platform;
  }
}

/** Farba badge-u pre platformu (Tailwind class). */
export function platformColorClass(platform: string): string {
  switch (platform) {
    case "dos":
      return "text-platform-dos";
    case "ps1":
      return "text-platform-ps1";
    case "ps2":
      return "text-platform-ps2";
    default:
      return "text-muted-foreground";
  }
}
