/**
 * Application identity — read from NEXT_PUBLIC_APP_NAME with safe fallback.
 * Per prompt "JAŇO ŠE CHCE BAVKAC" extension.
 */

export const APP_NAME =
  process.env.NEXT_PUBLIC_APP_NAME ?? "Jaňo še chce bavkac";

export const APP_NAME_DISPLAY = APP_NAME.toUpperCase();

export const APP_SHORT_NAME = "Jaňo";

export const APP_DESCRIPTION =
  "Emulátor vlastných DOS a PlayStation hier pre PC, Android a Android TV.";

/** Internal package identifier — without diacritics, used in Android package name. */
export const APP_PACKAGE_ID = "sk.jano.bavkac";

/** Slug for download filenames (no diacritics, lowercase, hyphen-separated). */
export const APP_SLUG = "jano-se-chce-bavkac";
