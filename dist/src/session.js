import { cleanSeed } from "./core.js";
import { VERSION, TITLES, makePuzzle, rotatePiece, trace, nextHint, puzzleScore } from "./model.js";

export const RUN_VERSION = "light-run-v1";
export const MAX_ACTIONS = 1024;
export const MAX_UNDO = 256;
export const MAX_RECENT = 12;
export const MAX_RECORDS = 120;
export const MAX_STORAGE_BYTES = 512 * 1024;
const modes = ["practice", "limited"];
const setting = (p) => p.type === "filter" ? p.color : p.turn;

// A legal witness, not a minimum-move claim. Never changes the generated board.
export function challengePlan(puzzle) {
  const pieces = puzzle.pieces.map((p) => ({ ...p })), rotations = [];
  for (let i = 0; i < pieces.length && !trace(puzzle, pieces).solved; i++) {
    if (!pieces[i].fixed && !pieces[i].decoy && setting(pieces[i]) !== setting(puzzle.solution[i])) {
      pieces[i] = rotatePiece(pieces[i]);
      rotations.push(i);
    }
  }
  if (!rotations.length || !trace(puzzle, pieces).solved) throw Error("No legal challenge witness");
  return { rotations, budget: rotations.length + Math.max(1, Math.floor(rotations.length / 5)) };
}

export function createRun(stage, seed, mode = "practice") {
  if (!modes.includes(mode)) throw TypeError("Invalid mode");
  seed = cleanSeed(seed);
  const puzzle = makePuzzle(stage, seed);
  return { puzzle, seed, stage, mode, pieces: puzzle.pieces.map((p) => ({ ...p })),
    budget: mode === "limited" ? challengePlan(puzzle).budget : null,
    actions: [], history: [], moves: 0, hints: 0, highlight: -1 };
}

export function runStatus(run) {
  if (trace(run.puzzle, run.pieces).solved) return "complete";
  if (run.mode === "limited" && run.moves >= run.budget) return "failed";
  return run.actions.length >= MAX_ACTIONS ? "full" : "playing";
}

export function applyAction(run, action) {
  if (runStatus(run) !== "playing" || !action || typeof action !== "object") throw Error("Run cannot accept action");
  const pieces = run.pieces.map((p) => ({ ...p })), history = [...run.history];
  let moves = run.moves, hints = run.hints, highlight = -1, canonical;
  if (action.type === "rotate") {
    const i = action.index;
    if (!Number.isInteger(i) || !pieces[i] || pieces[i].fixed) throw TypeError("Invalid rotation");
    pieces[i] = rotatePiece(pieces[i]);
    history.push(i);
    if (history.length > MAX_UNDO) history.shift();
    moves++;
    canonical = { type: "rotate", index: i };
  } else if (action.type === "undo") {
    if (!history.length) throw Error("Nothing to undo");
    const i = history.pop();
    pieces[i] = rotatePiece(pieces[i]);
    moves++;
    canonical = { type: "undo" };
  } else if (action.type === "hint") {
    highlight = nextHint(run.puzzle, pieces);
    if (highlight < 0) throw Error("No hint available");
    hints++;
    canonical = { type: "hint" };
  } else throw TypeError("Invalid action");
  return { ...run, pieces, history, moves, hints, highlight, actions: [...run.actions, canonical] };
}

export function snapshotRun(run) {
  return { version: VERSION, rulesVersion: RUN_VERSION, seed: run.seed, stage: run.stage,
    mode: run.mode, actions: run.actions.map((a) => ({ ...a })),
    settings: run.pieces.map(setting), moves: run.moves, hints: run.hints };
}

export function restoreRun(snapshot) {
  if (!snapshot || snapshot.version !== VERSION || snapshot.rulesVersion !== RUN_VERSION ||
    !modes.includes(snapshot.mode) ||
    !Array.isArray(snapshot.actions) || snapshot.actions.length > MAX_ACTIONS ||
    !Array.isArray(snapshot.settings) || snapshot.settings.length > 64) throw TypeError("Invalid saved run");
  let run = createRun(snapshot.stage, snapshot.seed, snapshot.mode);
  for (const action of snapshot.actions) {
    const keys = Object.keys(action ?? {}).sort().join(",");
    if (keys !== (action?.type === "rotate" ? "index,type" : "type")) throw TypeError("Invalid saved action");
    run = applyAction(run, action);
  }
  if (snapshot.moves !== run.moves || snapshot.hints !== run.hints ||
    JSON.stringify(snapshot.settings) !== JSON.stringify(run.pieces.map(setting))) throw Error("Saved replay mismatch");
  return run;
}

export function emptyStore() {
  return { schema: 1, version: VERSION, rulesVersion: RUN_VERSION, recent: [], last: null, records: [] };
}

export function recordId(record) {
  return [record.version, record.rulesVersion, record.seed, record.stage, record.mode, record.hints ? "assisted" : "independent"].join("|");
}

export function recordScore(record) {
  return puzzleScore(true, record.moves, record.hints);
}

export function normalizeStore(value) {
  const store = emptyStore();
  if (!value || value.schema !== 1 || value.version !== VERSION || value.rulesVersion !== RUN_VERSION) return store;
  if (Array.isArray(value.recent)) for (const entry of value.recent.slice(0, MAX_RECENT)) {
    try {
      const seed = cleanSeed(entry.seed);
      if (!Number.isInteger(entry.stage) || entry.stage < 1 || entry.stage > TITLES.length || !modes.includes(entry.mode)) continue;
      if (!store.recent.some((e) => e.seed === seed)) store.recent.push({ seed, stage: entry.stage, mode: entry.mode });
    } catch {}
  }
  try { if (value.last) store.last = snapshotRun(restoreRun(value.last)); } catch {}
  if (Array.isArray(value.records)) for (const entry of value.records.slice(-MAX_RECORDS)) {
    try {
      const run = restoreRun(entry);
      if (runStatus(run) !== "complete") continue;
      const record = snapshotRun(run), index = store.records.findIndex((r) => recordId(r) === recordId(record));
      if (index < 0) store.records.push(record);
      else if (recordScore(record) > recordScore(store.records[index])) store.records[index] = record;
    } catch {}
  }
  return boundStore(store);
}

export function boundStore(store) {
  const result = { ...store, recent: store.recent.slice(0, MAX_RECENT), records: store.records.slice(-MAX_RECORDS) };
  while (new TextEncoder().encode(JSON.stringify(result)).length > MAX_STORAGE_BYTES && result.records.length) result.records.shift();
  return result;
}

export function rememberRun(store, run) {
  const last = snapshotRun(run), records = [...store.records];
  if (runStatus(run) === "complete") {
    const index = records.findIndex((r) => recordId(r) === recordId(last));
    if (index < 0) records.push(last);
    else if (recordScore(last) > recordScore(records[index])) records[index] = last;
  }
  return boundStore({ ...store, last, records,
    recent: [{ seed: run.seed, stage: run.stage, mode: run.mode }, ...store.recent.filter((e) => e.seed !== run.seed)] });
}

export function stageRecords(store, seed, stage, mode) {
  return store.records.filter((r) => r.seed === seed && r.stage === stage && r.mode === mode);
}

export function independentCount(store) {
  return new Set(store.records.filter((r) => r.hints === 0).map((r) => r.stage)).size;
}
