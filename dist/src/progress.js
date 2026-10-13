export const PROGRESS_KEY = "web-lab-progress-v1";
export const APP_IDS = Object.freeze([
  "data-mirage", "echo-vault", "light-route", "logic-foundry", "neon-tactics",
  "orbit-courier", "packet-journey", "parcel-panic", "pixel-kitchen", "pocket-city",
  "route-race", "sense-lab", "swarm-garden", "think-forge", "traffic-lab",
]);
const LIMIT = 8192;
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const valid = (e) => exactKeys(e, ["completed", "total", "updatedAt"]) && Number.isInteger(e.completed) && Number.isInteger(e.total) &&
  e.completed >= 0 && e.completed <= e.total && e.total <= 1000 &&
  typeof e.updatedAt === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(e.updatedAt) &&
  Number.isFinite(Date.parse(e.updatedAt)) && new Date(e.updatedAt).toISOString() === e.updatedAt;

// Storage boundary: only the aggregate, never seeds, identities or replay data.
export function reportProgress(completed, total, storage, now = () => new Date()) {
  if (!Number.isInteger(completed) || !Number.isInteger(total) || completed < 1 || completed > total || total > 1000) return false;
  try { return updateSummary(storage, { completed, total, updatedAt: now().toISOString() }); }
  catch { return false; }
}
export function clearProgress(storage) { return updateSummary(storage, null); }
function updateSummary(storage, own) {
  try {
    storage ??= globalThis.localStorage;
    const raw = storage.getItem(PROGRESS_KEY);
    if (raw !== null && (typeof raw !== "string" || raw.length > LIMIT || new TextEncoder().encode(raw).length > LIMIT)) return false;
    const parsed = raw === null ? { version: 1, apps: {} } : JSON.parse(raw);
    if (!exactKeys(parsed, ["version", "apps"]) || parsed.version !== 1 || !object(parsed.apps)) return false;
    // D13: reject the entire shared state before any mutation; never sanitize peers.
    for (const [id, entry] of Object.entries(parsed.apps)) {
      if (!APP_IDS.includes(id) || !valid(entry)) return false;
    }
    if (!own && !Object.hasOwn(parsed.apps, "light-route")) return true;
    const apps = { ...parsed.apps };
    if (own) {
      if (!valid(own)) return false;
      apps["light-route"] = own;
    } else delete apps["light-route"];
    const next = JSON.stringify({ version: 1, apps });
    if (new TextEncoder().encode(next).length > LIMIT) return false;
    if (next === raw) return true;
    storage.setItem(PROGRESS_KEY, next);
    return storage.getItem(PROGRESS_KEY) === next;
  } catch { return false; }
}
