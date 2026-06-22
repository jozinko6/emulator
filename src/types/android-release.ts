/**
 * Android release metadata — per prompt section 8.
 */
export interface AndroidReleaseInfo {
  /** True ak je download reálne povolený. */
  enabled: boolean;
  /** Verzia (napr. "1.0.0"). */
  version: string;
  /** Version code (integer). */
  versionCode: number;
  /** URL pre mobilné APK (telefón + tablet). */
  mobileApkUrl: string;
  /** URL pre TV APK (ak je oddelené). */
  tvApkUrl: string;
  /** Univerzálne APK (ak je jedno pre všetko). */
  universalApkUrl?: string;
  /** Veľkosť APK v bajtoch. */
  sizeBytes: number;
  /** SHA-256 kontrolný súčet. */
  sha256: string;
  /** ISO dátum vydania. */
  releasedAt: string;
  /** Minimálna Android verzia (text). */
  minAndroidVersion: string;
}
