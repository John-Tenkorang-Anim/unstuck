/**
 * Draft photos and videos stay in this browser's IndexedDB until publishing
 * exists. Every call degrades to a no-op where IndexedDB is unavailable.
 */
const DB = "unstuck-media";
function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}
async function run<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await open();
  if (!db) return undefined;
  return new Promise<T | undefined>((resolve) => {
    const request = action(db.transaction("files", mode).objectStore("files"));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(undefined);
  });
}
export const putFile = (id: string, blob: Blob) =>
  run("readwrite", (s) => s.put(blob, id));
export const getFile = (id: string) => run<Blob>("readonly", (s) => s.get(id));
export const removeFile = (id: string) => run("readwrite", (s) => s.delete(id));
