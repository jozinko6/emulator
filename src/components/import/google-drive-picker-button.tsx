"use client";

/**
 * GoogleDrivePickerButton — tlačidlo, ktoré otvorí Google Picker.
 *
 * Per prompt ETAPA 8. Prijme konfiguráciu (clientId, apiKey, appId) z env
 * premenných. Po výbere súboru zavolá `onPick` s metadatami.
 *
 * Tlačidlo je responsívne a podporuje loading state.
 *
 * Komentáre v slovenčine.
 */
import { useState } from "react";
import { Cloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { openDrivePicker, type PickedDriveFile } from "@/lib/google-drive/picker";

interface GoogleDrivePickerButtonProps {
  onPick: (file: PickedDriveFile) => void;
  disabled?: boolean;
  /** Voliteľný label tlačidla. */
  label?: string;
}

export function GoogleDrivePickerButton({
  onPick,
  disabled,
  label = "Vybrať z Google Drive",
}: GoogleDrivePickerButtonProps) {
  const [opening, setOpening] = useState(false);
  const { toast } = useToast();

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

  const configured = Boolean(clientId && apiKey && appId);

  const handleClick = async () => {
    if (!configured) {
      toast({
        title: "Google Drive nie je nakonfigurovaný",
        description:
          "Pre použitie Picker-a nastavte NEXT_PUBLIC_GOOGLE_CLIENT_ID, NEXT_PUBLIC_GOOGLE_API_KEY a NEXT_PUBLIC_GOOGLE_APP_ID.",
        variant: "destructive",
      });
      return;
    }

    setOpening(true);
    try {
      const picked = await openDrivePicker(clientId!, apiKey!, appId!);
      if (picked) {
        onPick(picked);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({
        title: "Google Picker zlyhal",
        description: msg,
        variant: "destructive",
      });
      console.error("[google-drive-picker-button] Picker zlyhal:", e);
    } finally {
      setOpening(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => void handleClick()}
      disabled={disabled || opening}
      className="min-h-11 w-full sm:w-auto"
    >
      {opening ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Cloud className="size-4" aria-hidden="true" />
      )}
      {label}
    </Button>
  );
}
