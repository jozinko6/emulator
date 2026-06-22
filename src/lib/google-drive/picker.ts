/**
 * Google Picker API wrapper.
 * Per prompt section 20A — uses smallest scope (drive.file).
 * Token stored in sessionStorage (NOT localStorage).
 */

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: (override?: { prompt?: string }) => void };
        };
      };
      picker?: {
        PickerBuilder: new () => PickerBuilderLike;
        View: new (viewId: unknown) => unknown;
        ViewId: { DOCS: unknown };
        Feature: { MINE_ONLY: unknown; MULTISELECT_ENABLED: unknown };
        DocsViewMode: { GRID: unknown; LIST: unknown };
        Document: new (data: unknown) => unknown;
      };
    };
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

interface PickerBuilderLike {
  setOAuthToken: (token: string) => PickerBuilderLike;
  setDeveloperKey: (key: string) => PickerBuilderLike;
  setAppId: (id: string) => PickerBuilderLike;
  addView: (view: unknown) => PickerBuilderLike;
  enableFeature: (feature: unknown) => PickerBuilderLike;
  setCallback: (cb: (data: unknown) => void) => PickerBuilderLike;
  build: () => { setVisible: (visible: boolean) => void };
}

const TOKEN_STORAGE_KEY = "rc_drive_token";
const TOKEN_EXPIRY_KEY = "rc_drive_token_expiry";

interface CachedToken {
  token: string;
  expiresAt: number;
}

function getCachedToken(): string | null {
  if (typeof window === "undefined") return null;
  const t = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  const exp = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
  if (!t || !exp) return null;
  const expiresAt = parseInt(exp, 10);
  if (Date.now() >= expiresAt) {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    return null;
  }
  return t;
}

function setCachedToken(token: string, expiresInSec: number): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  sessionStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresInSec * 1000));
}

function clearCachedToken(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
}

export function loadGoogleApis(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("window unavailable"));
      return;
    }
    if (window.google?.accounts?.oauth2 && window.google?.picker) {
      resolve();
      return;
    }

    let remaining = 2;
    let firstError: unknown = null;
    const done = (err?: unknown) => {
      if (err && !firstError) firstError = err;
      remaining -= 1;
      if (remaining === 0) {
        if (firstError) reject(firstError);
        else resolve();
      }
    };

    // Load GIS
    const gisScript = document.createElement("script");
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => done();
    gisScript.onerror = () => done(new Error("GIS load failed"));
    document.head.appendChild(gisScript);

    // Load GAPI (for picker)
    const gapiScript = document.createElement("script");
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      if (window.gapi) {
        window.gapi.load("picker", () => done());
      } else {
        done(new Error("gapi unavailable"));
      }
    };
    gapiScript.onerror = () => done(new Error("GAPI load failed"));
    document.head.appendChild(gapiScript);
  });
}

export async function requestDriveAccessToken(
  clientId: string
): Promise<string> {
  if (!clientId) {
    throw new Error("NEXT_PUBLIC_GOOGLE_CLIENT_ID nie je nastavené");
  }
  await loadGoogleApis();
  if (!window.google?.accounts?.oauth2) {
    throw new Error("Google Identity Services nie sú dostupné");
  }

  const cached = getCachedToken();
  if (cached) return cached;

  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts!.oauth2!.initTokenClient({
      client_id: clientId,
      scope: "https://www.googleapis.com/auth/drive.file",
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          clearCachedToken();
          reject(new Error(resp.error ?? "OAuth token chýba"));
          return;
        }
        // Access tokens are valid for 1 hour (3600s). Cache for 55min to be safe.
        setCachedToken(resp.access_token, 3300);
        resolve(resp.access_token);
      },
    });
    client.requestAccessToken({ prompt: "consent" });
  });
}

export interface PickedDriveFile {
  fileId: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

/**
 * Opens the Google Drive Picker and resolves with the selected file.
 * Resolves with null if user cancels.
 */
export async function openDrivePicker(
  clientId: string,
  apiKey: string,
  appId: string
): Promise<PickedDriveFile | null> {
  if (!clientId || !apiKey) {
    throw new Error("Google Drive env premenné nie sú nastavené");
  }

  const token = await requestDriveAccessToken(clientId);
  await loadGoogleApis();
  if (!window.google?.picker) {
    throw new Error("Google Picker API nie je dostupné");
  }

  const g = window.google.picker;
  const view = new g.View(g.ViewId.DOCS);
  const builder = new g.PickerBuilder()
    .setOAuthToken(token)
    .setDeveloperKey(apiKey)
    .setAppId(appId)
    .addView(view)
    .enableFeature(g.Feature.MINE_ONLY)
    .setCallback((data: unknown) => {
      const d = data as { action: string; docs?: Array<{ id: string; name: string; mimeType: string; sizeBytes?: number }> };
      if (d.action === "picked" && d.docs && d.docs.length > 0) {
        const f = d.docs[0];
        if (pickerResolve) {
          pickerResolve({
            fileId: f.id,
            name: f.name,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes ?? 0,
          });
          pickerResolve = null;
        }
      } else if (d.action === "cancel") {
        if (pickerResolve) {
          pickerResolve(null);
          pickerResolve = null;
        }
      }
    });

  let pickerResolve: ((v: PickedDriveFile | null) => void) | null = null;
  const pickerPromise = new Promise<PickedDriveFile | null>((resolve) => {
    pickerResolve = resolve;
  });

  builder.build().setVisible(true);

  // Add a timeout — picker should resolve within 5 minutes
  return Promise.race([
    pickerPromise,
    new Promise<PickedDriveFile | null>((resolve) =>
      setTimeout(() => {
        pickerResolve = null;
        resolve(null);
      }, 300_000)
    ),
  ]);
}
