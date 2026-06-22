/**
 * Errors helpers — runtime runtime type guards pre chyby.
 *
 * Komentáre v slovenčine.
 */
import { RetroCloudError } from "@/types/errors";

/** Type guard: true, ak `e` je inštancia `RetroCloudError`. */
export function isRetroCloudError(e: unknown): e is RetroCloudError {
  return e instanceof RetroCloudError;
}
