export const PROGRESS_KEY = "web-lab-progress-v1";
export const APP_IDS = Object.freeze([
  "data-mirage", "echo-vault", "light-route", "logic-foundry", "neon-tactics",
  "orbit-courier", "packet-journey", "parcel-panic", "pixel-kitchen", "pocket-city",
  "route-race", "sense-lab", "swarm-garden", "think-forge", "traffic-lab",
]);
const LIMIT = 8192;
const valid = (e) => e && Number.isInteger(e.completed) && Number.isInteger(e.total) &&
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
    if (raw && (raw.length > LIMIT || new TextEncoder().encode(raw).length > LIMIT)) return false;
    const parsed = raw ? JSON.parse(raw) : { version: 1, apps: {} };
    if (parsed?.version !== 1 || !parsed.apps || typeof parsed.apps !== "object" || Array.isArray(parsed.apps)) return false;
    const apps = {};
    for (const id of APP_IDS) {
      if (!Object.hasOwn(parsed.apps, id)) continue;
      const e = parsed.apps[id];
      if (!valid(e)) return false;
      apps[id] = { completed: e.completed, total: e.total, updatedAt: e.updatedAt };
    }
    if (own) {
      if (!valid(own)) return false;
      apps["light-route"] = own;
    } else delete apps["light-route"];
    const next = JSON.stringify({ version: 1, apps });
    if (new TextEncoder().encode(next).length > LIMIT) return false;
    storage.setItem(PROGRESS_KEY, next);
    return true;
  } catch { return false; }
}
