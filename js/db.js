/* Tiny IndexedDB wrapper — everything is stored on-device (works offline). */
const DB = (() => {
  const NAME = 'body-app-db';
  const VERSION = 2;
  let dbp = null;

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('exercises')) {
          db.createObjectStore('exercises', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('media')) {
          const m = db.createObjectStore('media', { keyPath: 'id' });
          m.createIndex('byExercise', 'exerciseId');
        }
        if (!db.objectStoreNames.contains('sessions')) {
          const s = db.createObjectStore('sessions', { keyPath: 'id' });
          s.createIndex('byDate', 'date');
          s.createIndex('byExercise', 'exerciseId');
        }
        if (!db.objectStoreNames.contains('plans')) {
          db.createObjectStore('plans', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workouts')) {
          const w = db.createObjectStore('workouts', { keyPath: 'id' });
          w.createIndex('byDate', 'date');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbp;
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((resolve, reject) => {
      const t = db.transaction(store, mode);
      const s = t.objectStore(store);
      const out = fn(s);
      t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : out);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error);
    }));
  }

  const uid = () => crypto.randomUUID ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);

  return {
    uid,

    put: (store, obj) => tx(store, 'readwrite', s => { s.put(obj); return obj; }),
    del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
    get: (store, id) => open().then(db => new Promise((res, rej) => {
      const r = db.transaction(store).objectStore(store).get(id);
      r.onsuccess = () => res(r.result || null);
      r.onerror = () => rej(r.error);
    })),
    all: (store) => open().then(db => new Promise((res, rej) => {
      const r = db.transaction(store).objectStore(store).getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    })),
    byIndex: (store, index, value) => open().then(db => new Promise((res, rej) => {
      const r = db.transaction(store).objectStore(store).index(index).getAll(value);
      r.onsuccess = () => res(r.result || []);
      r.onerror = () => rej(r.error);
    })),

    /* Ask the browser to keep our data even under storage pressure
       (granted automatically for installed home-screen apps). */
    persist() {
      if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().catch(() => {});
      }
    }
  };
})();
