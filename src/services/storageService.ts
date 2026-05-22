
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";

// ----------------------------------------------------
// Circuit Breaker State
// ----------------------------------------------------
// If true, we stop trying to upload to avoid freezing the app with infinite retries
let storageCircuitOpen = false; 

// ----------------------------------------------------
// Helpers
// ----------------------------------------------------
export const safeName = (name: string) => {
  return (name || "arquivo")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100); // Limit length
};

const isLikelyCorsOrNetwork = (err: any) => {
  const msg = String(err?.message || err || "").toLowerCase();
  const code = String(err?.code || "").toLowerCase();
  return (
    msg.includes("cors") ||
    msg.includes("preflight") ||
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("net::err_failed") ||
    code.includes("storage/retry-limit-exceeded") ||
    code.includes("storage/unknown") ||
    code.includes("storage/unauthorized") ||
    code.includes("storage/canceled")
  );
};

export type UploadResult = {
  ok: boolean;
  url: string;                // ok=true: Storage URL | ok=false: Blob URL (local)
  storagePath: string | null; // ok=true: Path | ok=false: null
  fallbackReason?: "circuit_open" | "cors_or_network" | "upload_failed";
};

// ----------------------------------------------------
// Uploads
// ----------------------------------------------------
export async function uploadBlobToStorage(
  blob: Blob,
  storagePath: string,
  contentType = "application/pdf"
): Promise<UploadResult> {
  const localUrl = URL.createObjectURL(blob);

  // 1. Check Circuit Breaker
  if (storageCircuitOpen) {
    console.warn("[Storage] Circuit Open: Skipping upload to prevent freeze. Using local URL.");
    return { ok: false, url: localUrl, storagePath: null, fallbackReason: "circuit_open" };
  }

  try {
    const storage = getStorage();
    const r = ref(storage, storagePath);

    await uploadBytes(r, blob, { contentType });
    const url = await getDownloadURL(r);

    return { ok: true, url, storagePath };
  } catch (err: any) {
    // CRITICAL FIX: Do NOT log the full 'err' object, it causes circular structure JSON error in some browsers
    console.error("[uploadBlobToStorage] failed:", err.code || err.message || "Unknown Error");

    // 2. Trip Circuit Breaker on CORS/Network errors to prevent infinite loops
    if (isLikelyCorsOrNetwork(err)) {
      console.error("[Storage] CORS/Network error detected. Opening Circuit Breaker for this session.");
      storageCircuitOpen = true;
      return {
        ok: false,
        url: localUrl,
        storagePath: null,
        fallbackReason: "cors_or_network",
      };
    }

    return {
      ok: false,
      url: localUrl,
      storagePath: null,
      fallbackReason: "upload_failed",
    };
  }
}

export async function uploadFileToStorage(
  file: File,
  storagePath: string
): Promise<UploadResult> {
  // Reuse the blob logic which handles the circuit breaker
  return uploadBlobToStorage(file, storagePath, file.type || "application/octet-stream");
}

// ----------------------------------------------------
// Delete
// ----------------------------------------------------
export async function deleteFromStorage(storagePath?: string | null) {
  if (!storagePath || storageCircuitOpen) return;
  try {
    const storage = getStorage();
    const r = ref(storage, storagePath);
    await deleteObject(r);
  } catch (e: any) {
    // Safe logging
    console.warn("Delete failed (might be local fallback or permissions):", e.code || e.message);
  }
}
