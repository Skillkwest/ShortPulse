/**
 * Minimal IndexedDB helper for character data.
 * Local-first; if IndexedDB is unavailable, falls back to in-memory map.
 */

const DB_NAME = "shortpulse-character";
const STORE = "characters";
const DB_VERSION = 1;

type CharacterRecord<T> = {
  key: string;
  value: T;
};

const memoryStore = new Map<string, any>();

const openDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "key" });
      }
    };
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
    request.onsuccess = () => resolve(request.result);
  });

const put = async <T>(key: string, value: T) => {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      store.put({ key, value } as CharacterRecord<T>);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("IndexedDB put failed"));
    });
    db.close();
  } catch (_err) {
    memoryStore.set(key, value);
  }
};

const get = async <T>(key: string): Promise<T | null> => {
  try {
    const db = await openDb();
    const result = await new Promise<CharacterRecord<T> | null>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as CharacterRecord<T>) || null);
      req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));
    });
    db.close();
    return result ? result.value : null;
  } catch (_err) {
    return (memoryStore.get(key) as T) ?? null;
  }
};

export const characterStorage = {
  async saveCharacter<T>(key: string, value: T) {
    await put<T>(key, value);
  },
  async loadCharacter<T>(key: string): Promise<T | null> {
    return get<T>(key);
  },
};
