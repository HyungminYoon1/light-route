import { MAX_STORAGE_BYTES, emptyStore, normalizeStore } from "./session.js";

export const SESSION_KEY = "light-route-session-v1";
export function readStore(storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(SESSION_KEY);
    if (!raw || raw.length > MAX_STORAGE_BYTES || new TextEncoder().encode(raw).length > MAX_STORAGE_BYTES) return emptyStore();
    return normalizeStore(JSON.parse(raw));
  } catch { return emptyStore(); }
}
export function writeStore(store, storage) {
  try {
    storage ??= globalThis.localStorage;
    const raw = JSON.stringify(store);
    if (new TextEncoder().encode(raw).length > MAX_STORAGE_BYTES) return false;
    storage.setItem(SESSION_KEY, raw);
    return true;
  } catch { return false; }
}
export function clearStore(storage) {
  try {
    storage ??= globalThis.localStorage;
    storage.removeItem(SESSION_KEY);
    storage.removeItem("light-route-v1");
    return true;
  } catch { return false; }
}
