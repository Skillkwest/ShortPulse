/**
 * AI Studio session snapshot shadow storage.
 * Persists session snapshots in IndexedDB with an in-memory fallback for restricted runtimes.
 */
import type { AiStudioSessionSnapshotV1 } from "./sessionSnapshot";

const DB_NAME = "shortpulse-ai-studio";
const DB_VERSION = 1;
const STORE_NAME = "session_snapshots";

type SessionShadowRecord = {
  sessionId: string;
  snapshot: AiStudioSessionSnapshotV1;
  updatedAt: string;
};

const memoryShadowStore = new Map<string, SessionShadowRecord>();

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "sessionId" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
  });

/**
 * Persists one session snapshot shadow record keyed by `sessionId`.
 */
export const saveAiStudioSessionShadow = async (
  sessionId: string,
  snapshot: AiStudioSessionSnapshotV1
): Promise<void> => {
  const record: SessionShadowRecord = {
    sessionId,
    snapshot,
    updatedAt: snapshot.updatedAt,
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB put failed"));
    });
    db.close();
  } catch {
    memoryShadowStore.set(sessionId, record);
  }
};

/**
 * Loads one session snapshot shadow record by `sessionId`.
 */
export const loadAiStudioSessionShadow = async (
  sessionId: string
): Promise<AiStudioSessionSnapshotV1 | null> => {
  try {
    const db = await openDb();
    const record = await new Promise<SessionShadowRecord | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(sessionId);
      request.onsuccess = () => resolve((request.result as SessionShadowRecord) ?? null);
      request.onerror = () => reject(request.error ?? new Error("IndexedDB get failed"));
    });
    db.close();
    return record?.snapshot ?? null;
  } catch {
    return memoryShadowStore.get(sessionId)?.snapshot ?? null;
  }
};
