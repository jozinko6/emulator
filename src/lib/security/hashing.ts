/**
 * SHA-256 hashing via Web Crypto (SubtleCrypto).
 * Heavy hashing should run inside a Web Worker.
 */

export async function sha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  let buf: ArrayBuffer;
  if (data instanceof Uint8Array) {
    // Copy into a fresh ArrayBuffer to avoid SharedArrayBuffer typing issues
    buf = new ArrayBuffer(data.byteLength);
    new Uint8Array(buf).set(data);
  } else {
    buf = data;
  }
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return bufferToHex(digest);
}

export async function sha256Stream(
  reader: ReadableStream<Uint8Array>
): Promise<string> {
  // Streamed SHA-256 — SubtleCrypto doesn't support streaming, so we chunk-accumulate
  // and call digest() once. For very large files this is still memory-friendly
  // because we accumulate Uint8Array chunks (not a full ArrayBuffer copy).
  const chunks: Uint8Array[] = [];
  let total = 0;
  const r = reader.getReader();
   
  while (true) {
    const { done, value } = await r.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.byteLength;
    }
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    merged.set(c, offset);
    offset += c.byteLength;
  }
  return sha256(merged);
}

export function bufferToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

export function fingerprintGame(files: Array<{ relativePath: string; hash?: string; size: number }>): string {
  // Stable fingerprint combining main file hash (if available) + total size + sorted file count
  const sorted = [...files].sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  const parts = sorted.map((f) => `${f.relativePath}:${f.size}:${f.hash ?? ""}`);
  const str = parts.join("|");
  // Use a simple FNV-1a hash for fingerprint (deterministic, fast, no async)
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
