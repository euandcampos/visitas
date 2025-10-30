const DB_NAME = 'visitas-app';
const DB_VERSION = 1;
const STORE_QUEUE = 'queue';
const STORE_VISITS = 'visits';
const STORE_FILES = 'files';
const randomId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_QUEUE)) {
        db.createObjectStore(STORE_QUEUE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_VISITS)) {
        db.createObjectStore(STORE_VISITS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = callback(store, tx);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function enqueue(type, payload, options = {}) {
  const record = {
    id: randomId(),
    type,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
    ...options,
  };
  await withStore(STORE_QUEUE, 'readwrite', (store) => {
    store.put(record);
  });
  return record;
}

export async function getQueue() {
  return withStore(STORE_QUEUE, 'readonly', (store) => {
    return store.getAll();
  });
}

export async function removeFromQueue(id) {
  await withStore(STORE_QUEUE, 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function updateQueueRecord(record) {
  await withStore(STORE_QUEUE, 'readwrite', (store) => {
    store.put(record);
  });
}

export async function getQueueSize() {
  return withStore(STORE_QUEUE, 'readonly', (store) => store.count());
}

export async function storeVisitSnapshot(visit) {
  if (!visit || !visit.id) return;
  await withStore(STORE_VISITS, 'readwrite', (store) => {
    store.put({ id: visit.id, data: visit, savedAt: new Date().toISOString() });
  });
}

export async function getVisitSnapshot(id) {
  if (!id) return null;
  const record = await withStore(STORE_VISITS, 'readonly', (store) => store.get(id));
  return record ? record.data : null;
}

export async function deleteVisitSnapshot(id) {
  if (!id) return;
  await withStore(STORE_VISITS, 'readwrite', (store) => {
    store.delete(id);
  });
}

export async function saveFileBlob(localId, blob) {
  await withStore(STORE_FILES, 'readwrite', (store) => {
    store.put({ id: localId, blob });
  });
}

export async function getFileBlob(localId) {
  const record = await withStore(STORE_FILES, 'readonly', (store) => store.get(localId));
  return record ? record.blob : null;
}

export async function deleteFileBlob(localId) {
  await withStore(STORE_FILES, 'readwrite', (store) => {
    store.delete(localId);
  });
}

export async function clearAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_QUEUE, STORE_VISITS, STORE_FILES], 'readwrite');
    tx.objectStore(STORE_QUEUE).clear();
    tx.objectStore(STORE_VISITS).clear();
    tx.objectStore(STORE_FILES).clear();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

