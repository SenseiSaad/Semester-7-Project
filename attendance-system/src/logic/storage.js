/* storage.js — persistence driver for the whole app.
   The rest of the logic layer never touches this file: every function takes a
   plain `db` object in and returns results, so the storage backend can be
   swapped (localStorage → REST → IndexedDB) without touching business logic. */

const KEY = 'saes_db_v3';

const localStorageDriver = () => ({
  read: () => localStorage.getItem(KEY),
  write: (v) => localStorage.setItem(KEY, v),
  clear: () => localStorage.removeItem(KEY),
});

const memoryDriver = () => {
  let mem = null;
  return {
    read: () => mem,
    write: (v) => { mem = v; },
    clear: () => { mem = null; },
  };
};

let driver = typeof localStorage !== 'undefined' ? localStorageDriver() : memoryDriver();
let cache = null;
const listeners = new Set();

export function setDriver(d) { driver = d; cache = null; }
export function makeMemoryDriver() { return memoryDriver(); }

function persist(db) {
  try { driver.write(JSON.stringify(db)); }
  catch (e) { console.error('storage: persist failed', e); }
}

export function getDB() {
  if (cache) return cache;
  try { cache = JSON.parse(driver.read() || 'null'); } catch { cache = null; }
  if (!cache || !Array.isArray(cache.users)) {
    // eslint-disable-next-line global-require
    cache = requireSeed();
    persist(cache);
  }
  return cache;
}

export function update(mutator) {
  const db = getDB();
  mutator(db);
  cache = db;
  persist(db);
  listeners.forEach((fn) => fn(db));
  return db;
}

export function replaceDB(db) { cache = db; persist(db); listeners.forEach((fn) => fn(db)); }
export function resetToSeed() { replaceDB(requireSeed()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function clearDriver() { driver.clear(); cache = null; }

// late import to avoid a circular dependency (seed.js imports nothing from here)
let seedFn = null;
export function registerSeed(fn) { seedFn = fn; }
function requireSeed() {
  if (seedFn) return seedFn();
  return { users: [], courses: [], enrollments: [], sessions: [], attendanceRecords: [], qrTokens: [], violations: [] };
}
