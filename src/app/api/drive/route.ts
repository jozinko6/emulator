/**
 * Google Drive metadata proxy — ONLY metadata, never file content.
 *
 * PREČO EXISTUJE TENTO ENDPOINT:
 *   Google Drive API občas blokuje CORS pre niektoré operácie. Aplikácia
 *   primárne sťahuje súbory priamo v prehliadači (vid `/lib/google-drive/downloader.ts`).
 *   Tento server-side route slúži VÝHRADNE na stiahnutie METADÁT o súbore
 *   (názov, MIME, veľkosť), aby UI mohlo zobraziť informácie pred importom
 *   bez zverejňovania API kľúčov.
 *
 *   TENTO ROUTE NIKDY NEPROXYUJE OBSAH SÚBOROV. Stiahnutie ROM/ISO/BIOS
 *   cez server by porušilo hlavné bezpečnostné pravidlo projektu: všetky
 *   herné súbory zostávajú v zariadení používateľa.
 *
 * Per prompt ETAPA 8.
 *
 * Komentáre v slovenčine.
 */
import { NextResponse } from "next/server";

const ALLOWED_FIELDS = "id,name,mimeType,size";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fileId = url.searchParams.get("fileId");

  if (!fileId) {
    return NextResponse.json(
      { ok: false, error: "Chýba parameter fileId." },
      { status: 400 }
    );
  }

  // Sanitizácia: File ID môže obsahovať len [A-Za-z0-9_-]
  if (!/^[A-Za-z0-9_-]{20,60}$/.test(fileId)) {
    return NextResponse.json(
      { ok: false, error: "fileId má neplatný formát." },
      { status: 400 }
    );
  }

  // Volitelný OAuth token (ak prehliadač pošle access_token z Picker-a).
  const accessToken = request.headers.get("x-drive-token");

  const api = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(
    fileId
  )}?fields=${ALLOWED_FIELDS}`;

  try {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const resp = await fetch(api, { headers });
    if (!resp.ok) {
      // Nejedené overstiť detail chyby klientovi — vraciame len status.
      return NextResponse.json(
        {
          ok: false,
          error: `Drive API vrátil HTTP ${resp.status}.`,
        },
        { status: resp.status }
      );
    }

    const json = (await resp.json()) as {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
    };

    // Vraciame len vyčistené metadáta. Žiadny obsah.
    return NextResponse.json({
      ok: true,
      file: {
        id: json.id,
        name: json.name,
        mimeType: json.mimeType,
        size: typeof json.size === "string" ? parseInt(json.size, 10) : undefined,
      },
    });
  } catch (e) {
    console.error("[api/drive] metadata proxy zlyhal:", e);
    return NextResponse.json(
      { ok: false, error: "Nepodarilo sa získať metadáta zo Drive API." },
      { status: 502 }
    );
  }
}
