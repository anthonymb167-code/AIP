export interface StoredVoiceSample {
  key: string;
  label: string;
  mimeType: string;
  sourceKind: "recorded_media" | "live_mic" | "own_voice";
  blob: Blob;
  updatedAtIso: string;
}

const DB_NAME = "kith_studio_voice_samples_v1";
const STORE_NAME = "voice_samples";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open voice audio store."));
  });
}

export function getVoiceSampleKey(
  sourceKind: "recorded_media" | "live_mic" | "own_voice",
  userId?: string | null
): string {
  const owner = userId?.trim() || "local";
  return `${owner}:primary:${sourceKind}`;
}

export async function saveVoiceSample(sample: StoredVoiceSample): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(sample);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Failed to save voice sample."));
    };
  });
}

export async function loadVoiceSample(key: string): Promise<StoredVoiceSample | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(key);
    req.onsuccess = () => {
      db.close();
      resolve((req.result as StoredVoiceSample | undefined) ?? null);
    };
    req.onerror = () => {
      db.close();
      reject(req.error || new Error("Failed to load voice sample."));
    };
  });
}

export async function deleteVoiceSample(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error("Failed to delete voice sample."));
    };
  });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const str = String(reader.result || "");
      resolve(str.includes(",") ? str.split(",")[1] : str);
    };
    reader.onerror = () => reject(reader.error || new Error("Failed reading audio blob."));
    reader.readAsDataURL(blob);
  });
}
