// services/tileDiskCache.js
// Cache persistente (IndexedDB) para tiles OSM.

const DB_NAME = "meu-gps-3d";
const DB_VERSION = 1;
const STORE_TILES = "osmTiles";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TILES)) {
        const store = db.createObjectStore(STORE_TILES, { keyPath: "key" });
        store.createIndex("lastAccess", "lastAccess");
        store.createIndex("expiresAt", "expiresAt");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Falha ao abrir IndexedDB"));
  });

  return dbPromise;
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error || new Error("Transação abortada"));
    tx.onerror = () => reject(tx.error || new Error("Erro na transação"));
  });
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Erro no request"));
  });
}

export function createTileDiskCache(options = {}) {
  const ttlMs = Math.max(10_000, Number(options.ttlMs) || 86_400_000);
  const maxEntries = Math.max(10, Math.floor(Number(options.maxEntries) || 250));
  const maxStaleMs = Math.max(
    0,
    Number.isFinite(options.maxStaleMs) ? Number(options.maxStaleMs) : 7 * 86_400_000,
  );

  const stats = {
    hits: 0,
    misses: 0,
    staleServed: 0,
    writes: 0,
    pruned: 0,
    errors: 0,
  };

  async function get(key, { now = Date.now() } = {}) {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_TILES, "readwrite");
      const store = tx.objectStore(STORE_TILES);
      const record = await reqToPromise(store.get(key));

      if (!record) {
        stats.misses += 1;
        await txDone(tx);
        return { status: "miss", record: null };
      }

      record.lastAccess = now;
      store.put(record);
      await txDone(tx);

      if (!Number.isFinite(record.expiresAt) || !Number.isFinite(record.fetchedAt)) {
        stats.misses += 1;
        return { status: "miss", record: null };
      }

      const isExpired = now > record.expiresAt;
      if (!isExpired) {
        stats.hits += 1;
        return { status: "hit", record };
      }

      const ageMs = now - record.fetchedAt;
      if (ageMs <= maxStaleMs) {
        stats.staleServed += 1;
        return { status: "stale", record };
      }

      stats.misses += 1;
      return { status: "miss", record: null };
    } catch (error) {
      stats.errors += 1;
      return { status: "error", record: null, error };
    }
  }

  async function set(key, data, { now = Date.now() } = {}) {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_TILES, "readwrite");
      const store = tx.objectStore(STORE_TILES);
      const record = {
        key,
        data,
        fetchedAt: now,
        expiresAt: now + ttlMs,
        lastAccess: now,
      };
      store.put(record);
      await txDone(tx);
      stats.writes += 1;
    } catch (error) {
      stats.errors += 1;
    }
  }

  async function prune({ protectedKeys = new Set() } = {}) {
    try {
      const db = await openDb();
      const countTx = db.transaction(STORE_TILES, "readonly");
      const store = countTx.objectStore(STORE_TILES);
      const currentCount = await reqToPromise(store.count());
      await txDone(countTx);

      if (!Number.isFinite(currentCount) || currentCount <= maxEntries) return;

      const tx = db.transaction(STORE_TILES, "readwrite");
      const rwStore = tx.objectStore(STORE_TILES);
      const index = rwStore.index("lastAccess");

      let remainingToDelete = currentCount - maxEntries;
      const cursorReq = index.openCursor();

      await new Promise((resolve, reject) => {
        cursorReq.onerror = () => reject(cursorReq.error || new Error("Erro no cursor"));
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor || remainingToDelete <= 0) {
            resolve();
            return;
          }

          const value = cursor.value;
          if (value?.key && !protectedKeys.has(value.key)) {
            cursor.delete();
            remainingToDelete -= 1;
            stats.pruned += 1;
          }

          cursor.continue();
        };
      });

      await txDone(tx);
    } catch (error) {
      stats.errors += 1;
    }
  }

  async function clear() {
    try {
      const db = await openDb();
      const tx = db.transaction(STORE_TILES, "readwrite");
      tx.objectStore(STORE_TILES).clear();
      await txDone(tx);
    } catch (error) {
      stats.errors += 1;
    }
  }

  function getStats() {
    return { ...stats, ttlMs, maxEntries, maxStaleMs };
  }

  return {
    get,
    set,
    prune,
    clear,
    getStats,
  };
}

