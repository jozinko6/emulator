/**
 * Path normalization and security utilities.
 * Per prompt section 11 — protect against path traversal, abs paths, drive letters, UNC, null bytes.
 */

const MAX_PATH_LENGTH = 300;
const MAX_DIR_DEPTH = 20;

export class PathSecurityError extends Error {
  readonly reason:
    | "absolute"
    | "drive-letter"
    | "unc"
    | "null-byte"
    | "traversal"
    | "too-long"
    | "too-deep";
  constructor(reason: PathSecurityError["reason"], message: string) {
    super(message);
    this.name = "PathSecurityError";
    this.reason = reason;
  }
}

/**
 * Normalize and validate a path from an archive entry.
 * Returns a posix-style relative path without leading slashes or `../` segments.
 * Throws PathSecurityError on dangerous input.
 */
export function normalizePath(raw: string): string {
  if (typeof raw !== "string") {
    throw new PathSecurityError("traversal", "Path is not a string");
  }

  // Null byte — hard reject
  if (raw.includes("\0")) {
    throw new PathSecurityError("null-byte", `Path contains null byte: ${raw}`);
  }

  // Windows drive letter (C:\, D:/, ...)
  if (/^[a-zA-Z]:[\\/]/.test(raw)) {
    throw new PathSecurityError("drive-letter", `Absolute drive path: ${raw}`);
  }

  // UNC path (\\server\share)
  if (/^[\\/][\\/]/.test(raw)) {
    throw new PathSecurityError("unc", `UNC path: ${raw}`);
  }

  // Absolute posix path
  if (raw.startsWith("/") || raw.startsWith("\\")) {
    // strip leading slashes — be lenient but record
    raw = raw.replace(/^[\\/]+/, "");
  }

  // Normalize backslashes to forward slashes
  let p = raw.replace(/\\/g, "/");

  // Reject `..` segments
  const segments = p.split("/");
  for (const seg of segments) {
    if (seg === "..") {
      throw new PathSecurityError(
        "traversal",
        `Path traversal detected: ${raw}`
      );
    }
  }

  // Collapse multiple slashes + trim
  p = p.replace(/\/+/g, "/").replace(/^\/+|\/+$/g, "");

  if (p.length > MAX_PATH_LENGTH) {
    throw new PathSecurityError(
      "too-long",
      `Path too long (${p.length} > ${MAX_PATH_LENGTH}): ${p}`
    );
  }

  const depth = p.split("/").filter(Boolean).length;
  if (depth > MAX_DIR_DEPTH) {
    throw new PathSecurityError(
      "too-deep",
      `Directory too deep (${depth} > ${MAX_DIR_DEPTH}): ${p}`
    );
  }

  return p;
}

export function isPathSafe(raw: string): boolean {
  try {
    normalizePath(raw);
    return true;
  } catch {
    return false;
  }
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^[\\/]+|[\\/]+$/g, ""))
    .filter(Boolean)
    .join("/");
}

export function dirname(p: string): string {
  const normalized = p.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? "" : normalized.slice(0, idx);
}

export function basename(p: string): string {
  const normalized = p.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/");
  return idx === -1 ? normalized : normalized.slice(idx + 1);
}

export function extname(p: string): string {
  const b = basename(p);
  const idx = b.lastIndexOf(".");
  return idx === -1 ? "" : b.slice(idx + 1).toLowerCase();
}
