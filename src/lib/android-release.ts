/**
 * Android release metadata loader.
 * Per prompt section 8 — APK distribution.
 *
 * Skúsi nahrať z env premenných, ak nie sú nastavené, skúsi public/downloads/android-release.json,
 * ak neexistuje, vráti null a tlačidlo sa skryje / zobrazí "pripravuje sa".
 */
import type { AndroidReleaseInfo } from "@/types/android-release";

let cached: AndroidReleaseInfo | null | undefined;

export async function getAndroidReleaseInfo(): Promise<AndroidReleaseInfo | null> {
  if (cached !== undefined) return cached;

  // 1. Skús env premenné (server-rendered)
  if (process.env.NEXT_PUBLIC_ANDROID_DOWNLOAD_ENABLED === "true") {
    const info: AndroidReleaseInfo = {
      enabled: true,
      version: process.env.NEXT_PUBLIC_ANDROID_VERSION ?? "",
      versionCode: 1,
      mobileApkUrl: process.env.NEXT_PUBLIC_ANDROID_APK_URL ?? "",
      tvApkUrl: process.env.NEXT_PUBLIC_ANDROID_TV_APK_URL ?? "",
      universalApkUrl: process.env.NEXT_PUBLIC_ANDROID_APK_URL ?? "",
      sizeBytes: 0,
      sha256: process.env.NEXT_PUBLIC_ANDROID_APK_SHA256 ?? "",
      releasedAt: new Date().toISOString(),
      minAndroidVersion: process.env.NEXT_PUBLIC_ANDROID_MIN_VERSION ?? "Android 8 (API 26)",
    };
    cached = info;
    return info;
  }

  // 2. Skús statický JSON súbor
  if (typeof window !== "undefined") {
    try {
      const resp = await fetch("/downloads/android-release.json", { cache: "no-cache" });
      if (resp.ok) {
        const data = (await resp.json()) as AndroidReleaseInfo;
        cached = data;
        return data;
      }
    } catch {
      // Ignored — fall through to null
    }
  }

  cached = null;
  return null;
}
