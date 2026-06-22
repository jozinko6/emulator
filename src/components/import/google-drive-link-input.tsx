"use client";

/**
 * GoogleDriveLinkInput — input pre verejný Drive odkaz.
 *
 * Per prompt ETAPA 8. Prijme reťazec, validuje cez `parseDriveUrl` a po
 * úspechu zavolá `onResolved` s fileId. Pri neplatnom vstupe zobrazí inline
 * chybu s krátkym vysvetlením.
 *
 * Komentáre v slovenčine.
 */
import { useState } from "react";
import { Link2, AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseDriveUrl } from "@/lib/google-drive/url-parser";

interface GoogleDriveLinkInputProps {
  onResolved: (fileId: string, originalUrl: string) => void;
  disabled?: boolean;
}

export function GoogleDriveLinkInput({ onResolved, disabled }: GoogleDriveLinkInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = parseDriveUrl(value);
    if (!result.ok || !result.fileId) {
      setError(result.reason ?? "Neplatný odkaz.");
      return;
    }
    setError(null);
    onResolved(result.fileId, value.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Link2
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={disabled}
            placeholder="https://drive.google.com/file/d/…/view"
            aria-label="Verejný Google Drive odkaz"
            aria-invalid={error ? "true" : "false"}
            className="h-11 pl-9"
          />
        </div>
        <Button
          type="submit"
          disabled={disabled || !value.trim()}
          className="min-h-11"
        >
          <ArrowRight className="size-4" aria-hidden="true" />
          Pokračovať
        </Button>
      </div>
      {error && (
        <p
          className="flex items-start gap-2 text-xs text-destructive"
          role="alert"
        >
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      <p className="text-[11px] text-muted-foreground">
        Podporované formáty: <code>/file/d/ID/</code>, <code>?id=ID</code>, <code>?export=download&id=ID</code>.
        Súbor musí byť verejne dostupný.
      </p>
    </form>
  );
}
