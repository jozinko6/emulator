/**
 * Google Drive file downloader — streams directly into OPFS.
 * Per prompt section 20: large files must NOT go through Vercel API or RAM.
 */
import { writeStream } from "@/lib/storage/opfs";
import { RetroCloudError } from "@/types/errors";

const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

export interface DownloadOptions {
  fileId: string;
  opfsPath: string;
  mimeType?: string;
  onProgress?: (downloaded: number, total: number) => void;
  signal?: AbortSignal;
}

export async function getDriveFileMetadata(
  fileId: string,
  accessToken: string
): Promise<{ name: string; mimeType: string; sizeBytes: number }> {
  const url = `${DRIVE_API_BASE}/${fileId}?fields=name,mimeType,size`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!resp.ok) {
    if (resp.status === 401 || resp.status === 403) {
      throw new RetroCloudError("PRIVATE_DRIVE_FILE", "Súbor nie je verejne dostupný alebo nemáte prístup.", {
        technicalDetail: `Drive API ${resp.status}`,
      });
    }
    throw new RetroCloudError("NETWORK_ERROR", `Drive API vrátil ${resp.status}`);
  }
  const data = (await resp.json()) as { name?: string; mimeType?: string; size?: string };
  return {
    name: data.name ?? fileId,
    mimeType: data.mimeType ?? "application/octet-stream",
    sizeBytes: data.size ? parseInt(data.size, 10) : 0,
  };
}

/**
 * Attempts to stream the file directly from Google Drive into OPFS.
 * Will throw RetroCloudError(CORS_BLOCKED) if browser blocks the cross-origin request,
 * with a recovery hint to use Picker or manual download.
 */
export async function downloadDriveFileToOpfs(opts: DownloadOptions): Promise<{ size: number }> {
  const { fileId, opfsPath, onProgress, signal } = opts;

  const url = `${DRIVE_API_BASE}/${fileId}?alt=media`;
  let resp: Response;
  try {
    resp = await fetch(url, { signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new RetroCloudError(
      "CORS_BLOCKED",
      "Priame stiahnutie z Google Drive bolo blokované prehliadačom.",
      {
        cause: e,
        technicalDetail: String(e),
        recoveryHint:
          "Použite Google Drive Picker alebo stiahnite súbor manuálne a importujte ho lokálne.",
      }
    );
  }

  if (!resp.ok) {
    if (resp.status === 403 || resp.status === 404) {
      throw new RetroCloudError(
        "PRIVATE_DRIVE_FILE",
        "Súbor na Google Drive nie je verejne dostupný.",
        {
          technicalDetail: `HTTP ${resp.status}`,
          recoveryHint:
            "Nastavte súbor ako verejne dostupný alebo použite Google Drive Picker.",
        }
      );
    }
    throw new RetroCloudError("NETWORK_ERROR", `Drive API vrátil HTTP ${resp.status}`);
  }

  if (!resp.body) {
    throw new RetroCloudError("NETWORK_ERROR", "Drive API nevrátil readable stream");
  }

  const total = parseInt(resp.headers.get("content-length") ?? "0", 10);
  let downloaded = 0;

  // Transform stream to report progress
  const progressStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = resp.body!.getReader();
      try {
         
        while (true) {
          if (signal?.aborted) {
            await reader.cancel();
            controller.error(new DOMException("Aborted", "AbortError"));
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            downloaded += value.byteLength;
            onProgress?.(downloaded, total);
            controller.enqueue(value);
          }
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return writeStream(opfsPath, progressStream, (written) => onProgress?.(written, total));
}
