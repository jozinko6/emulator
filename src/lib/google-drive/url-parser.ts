/**
 * Google Drive URL parser — supports 4 public link formats.
 * Per prompt section 20B.
 */

const DRIVE_DOMAINS = ["drive.google.com", "docs.google.com"];

export interface DriveUrlParseResult {
  ok: boolean;
  fileId?: string;
  reason?: string;
}

export function parseDriveUrl(raw: string): DriveUrlParseResult {
  if (typeof raw !== "string" || raw.trim() === "") {
    return { ok: false, reason: "Prázdny vstup" };
  }

  let url: URL;
  try {
    // Accept URLs without protocol
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    url = new URL(normalized);
  } catch {
    return { ok: false, reason: "Neplatná URL" };
  }

  if (!DRIVE_DOMAINS.includes(url.hostname)) {
    return { ok: false, reason: `Neplatná doména: ${url.hostname}` };
  }

  // Pattern 1: /file/d/FILE_ID/view
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  if (fileMatch && fileMatch[1]) {
    return { ok: true, fileId: fileMatch[1] };
  }

  // Pattern 2: /open?id=FILE_ID
  if (url.pathname === "/open") {
    const id = url.searchParams.get("id");
    if (id) return { ok: true, fileId: id };
  }

  // Pattern 3: /uc?id=FILE_ID
  if (url.pathname === "/uc") {
    const id = url.searchParams.get("id");
    if (id) return { ok: true, fileId: id };
  }

  // Pattern 4: export=download&id=FILE_ID (query-only style)
  const exportId = url.searchParams.get("id");
  if (url.searchParams.get("export") === "download" && exportId) {
    return { ok: true, fileId: exportId };
  }

  return { ok: false, reason: "Nerozpoznaný formát Drive odkazu" };
}
