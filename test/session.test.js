import test from "node:test";
import assert from "node:assert/strict";
import { VERSION, TITLES, trace } from "../dist/src/model.js";
import { RUN_VERSION, MAX_ACTIONS, MAX_STORAGE_BYTES, MAX_RECORDS, MAX_RECENT,
  createRun, challengePlan, applyAction, snapshotRun, restoreRun, runStatus,
  emptyStore, normalizeStore, boundStore, rememberRun, independentCount, stageRecords, recordScore } from "../dist/src/session.js";
import { SESSION_KEY, readStore, writeStore, clearStore } from "../dist/src/storage.js";
import { APP_IDS, PROGRESS_KEY, reportProgress, clearProgress } from "../dist/src/progress.js";

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
test("resume rejects unexpected result fields instead of silently stripping them", () => {
  const snapshot = snapshotRun(createRun(18, "strict-resume"));
  for (const field of ["score", "status", "player", "extra"]) {
    const forged = { ...snapshot, [field]: field === "score" ? 1000 : "complete" };
    assert.throws(() => restoreRun(forged), TypeError);
    assert.equal(normalizeStore({ ...emptyStore(), last: forged, records: [forged] }).last, null);
  }
  assert.deepEqual(snapshotRun(restoreRun(snapshot)), snapshot);
});
function finish(run) {
  for (const index of challengePlan(run.puzzle).rotations) {
    if (runStatus(run) === "complete") break;
    run = applyAction(run, { type: "rotate", index });
  }
  assert.equal(runStatus(run), "complete");
  return run;
}

test("360 legal limited-move completions preserve v2 starts, and exhausting budgets fails", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) for (let seed = 0; seed < 20; seed++) {
    const run = createRun(stage, `limit-${seed}`, "limited"), plan = challengePlan(run.puzzle);
    assert.ok(plan.rotations.length < plan.budget);
    assert.deepEqual(run.pieces, createRun(stage, run.seed).pieces);
    const done = finish(run);
    assert.equal(done.hints, 0);
    assert.ok(done.moves <= done.budget);
    assert.deepEqual(snapshotRun(restoreRun(snapshotRun(done))), snapshotRun(done));
    assert.throws(() => applyAction(done, { type: "undo" }));
    let failed = run;
    while (runStatus(failed) === "playing") {
      // Pick an actual legal rotation that does not solve, never inject counters.
      const index = failed.pieces.findIndex((p, i) => {
        if (p.fixed) return false;
        const trial = applyAction(failed, { type: "rotate", index: i });
        return !trace(trial.puzzle, trial.pieces).solved;
      });
      assert.ok(index >= 0);
      failed = applyAction(failed, { type: "rotate", index });
    }
    assert.equal(runStatus(failed), "failed");
    assert.equal(failed.moves, failed.budget);
    assert.throws(() => applyAction(failed, { type: "rotate", index: plan.rotations[0] }));
    assert.equal(rememberRun(emptyStore(), failed).records.length, 0);
    assert.equal(runStatus(restoreRun(snapshotRun(failed))), "failed");
  }
});

test("completion on the last allowed action succeeds; one extra action is rejected", () => {
  let run = createRun(18, "exact-budget", "limited");
  const plan = challengePlan(run.puzzle);
  // Spend the slack on real decoy rotations, then execute the witness.
  const decoy = run.pieces.findIndex((p) => p.decoy);
  for (let i = 0; i < run.budget - plan.rotations.length; i++) run = applyAction(run, { type: "rotate", index: decoy });
  for (const index of plan.rotations) run = applyAction(run, { type: "rotate", index });
  assert.equal(run.moves, run.budget);
  assert.equal(runStatus(run), "complete");
  const tampered = snapshotRun(run);
  tampered.actions.push({ type: "rotate", index: decoy });
  assert.throws(() => restoreRun(tampered));
});

test("round-trip resume preserves exact orientation, hints, undo and mode across all stages", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) for (const mode of ["practice", "limited"]) {
    let run = createRun(stage, "resume-qa", mode);
    const index = challengePlan(run.puzzle).rotations[0];
    run = applyAction(run, { type: "rotate", index });
    run = applyAction(run, { type: "undo" });
    run = applyAction(run, { type: "hint" });
    run = applyAction(run, { type: "rotate", index });
    const restored = restoreRun(JSON.parse(JSON.stringify(snapshotRun(run))));
    assert.deepEqual(restored, run);
    assert.equal(restored.moves, 3);
    assert.equal(restored.hints, 1);
    if (runStatus(run) === "playing") assert.deepEqual(applyAction(restored, { type: "undo" }), applyAction(run, { type: "undo" }));
    const storage = memoryStorage();
    const store = rememberRun(emptyStore(), run);
    assert.equal(writeStore(store, storage), true);
    assert.deepEqual(readStore(storage), store);
  }
});

test("replay rejects forged counters/orientations, fixed moves, invalid actions and versions", () => {
  const run = createRun(18, "validation-qa"), snapshot = snapshotRun(run);
  const fixed = run.pieces.findIndex((p) => p.fixed);
  const mutations = [
    (s) => { s.moves++; }, (s) => { s.hints++; }, (s) => { s.settings[0] = "bad"; },
    (s) => { s.version = "light-v1"; }, (s) => { s.rulesVersion = "other"; },
    (s) => { s.mode = "ranked"; }, (s) => { delete s.mode; }, (s) => { s.stage = 19; }, (s) => { s.seed = "<script>"; },
    (s) => { s.actions = [{ type: "rotate", index: fixed }]; },
    (s) => { s.actions = [{ type: "rotate", index: -1 }]; },
    (s) => { s.actions = [{ type: "hint", score: 1000 }]; },
    (s) => { s.actions = [{ type: "undo" }]; },
    (s) => { s.actions = [{ type: "inject", score: 1000 }]; },
    (s) => { s.actions = Array(MAX_ACTIONS + 1).fill({ type: "hint" }); },
  ];
  for (const mutate of mutations) {
    const s = structuredClone(snapshot); mutate(s);
    assert.throws(() => restoreRun(s));
    assert.equal(normalizeStore({ ...emptyStore(), last: s, records: [s] }).last, null);
  }
  assert.equal(snapshot.version, VERSION);
  assert.equal(snapshot.rulesVersion, RUN_VERSION);
});

test("bounded input and undo retain replay correctness without erasing hint provenance", () => {
  let run = createRun(1, "bounds-qa");
  const index = challengePlan(run.puzzle).rotations[0];
  for (let i = 0; i < 258; i++) run = applyAction(run, { type: "rotate", index });
  assert.equal(run.history.length, 256);
  run = applyAction(run, { type: "hint" });
  run = applyAction(run, { type: "undo" });
  assert.equal(run.moves, 259);
  assert.equal(run.hints, 1);
  assert.deepEqual(restoreRun(snapshotRun(run)), run);
  let full = createRun(1, "full-qa");
  for (let i = 0; i < MAX_ACTIONS; i++) full = applyAction(full, { type: "hint" });
  assert.equal(runStatus(full), "full");
  assert.equal(runStatus(restoreRun(snapshotRun(full))), "full");
  assert.throws(() => applyAction(full, { type: "hint" }));
});

test("independent, assisted and limited records stay separate; views/hints do not earn progress", () => {
  let store = emptyStore();
  const practice = createRun(1, "records-qa"), limited = createRun(1, "records-qa", "limited");
  store = rememberRun(store, applyAction(practice, { type: "hint" }));
  assert.equal(independentCount(store), 0);
  const assisted = finish(applyAction(practice, { type: "hint" }));
  store = rememberRun(store, assisted);
  assert.equal(independentCount(store), 0);
  store = rememberRun(store, finish(practice));
  store = rememberRun(store, finish(limited));
  assert.equal(independentCount(store), 1);
  assert.equal(stageRecords(store, "records-qa", 1, "practice").length, 2);
  assert.equal(stageRecords(store, "records-qa", 1, "limited").length, 1);
  assert.equal(store.records.length, 3);
  const score = recordScore(store.records.find((r) => r.mode === "practice" && r.hints === 0));
  store = rememberRun(store, assisted);
  assert.equal(recordScore(store.records.find((r) => r.mode === "practice" && r.hints === 0)), score);
  assert.deepEqual(normalizeStore(JSON.parse(JSON.stringify(store))), store);
});

test("history and records are bounded, oversize/corrupt storage fails safely, clear only own keys", () => {
  let store = emptyStore();
  for (let i = 0; i < MAX_RECORDS + 5; i++) store = rememberRun(store, finish(createRun(i % TITLES.length + 1, `bounded-${i}`)));
  assert.equal(store.records.length, MAX_RECORDS);
  assert.equal(store.recent.length, MAX_RECENT);
  assert.equal(store.recent[0].seed, "bounded-124");
  assert.ok(new TextEncoder().encode(JSON.stringify(store)).length <= MAX_STORAGE_BYTES);
  const storage = memoryStorage();
  assert.equal(writeStore(store, storage), true);
  assert.deepEqual(readStore(storage), store);
  storage.setItem(SESSION_KEY, "x".repeat(MAX_STORAGE_BYTES + 1));
  assert.deepEqual(readStore(storage), emptyStore());
  storage.setItem(SESSION_KEY, "{");
  assert.deepEqual(readStore(storage), emptyStore());
  assert.deepEqual(normalizeStore({ ...store, schema: 2 }), emptyStore());
  const blocked = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.deepEqual(readStore(blocked), emptyStore());
  assert.equal(writeStore(store, blocked), false);
  assert.equal(clearStore(blocked), false);
  storage.setItem("light-route-v1", "legacy"); storage.setItem("other-app", "keep");
  assert.equal(clearStore(storage), true);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem("light-route-v1"), null);
  assert.equal(storage.getItem("other-app"), "keep");
});

test("gallery summary uses 15 allowlisted aggregate entries, genuine dates and own-only clear", () => {
  const storage = memoryStorage(), instant = "2026-10-09T03:00:00.000Z", now = () => new Date(instant);
  assert.equal(APP_IDS.length, 15);
  assert.equal(new Set(APP_IDS).size, 15);
  // D13: the user's 2026-10-13 decision supersedes the old sanitize-evil expectation.
  const peer = { completed: 2, total: 5, updatedAt: instant };
  const unknown = JSON.stringify({ version: 1, apps: { "think-forge": peer, evil: { seed: "private" } } });
  storage.setItem(PROGRESS_KEY, unknown);
  assert.equal(reportProgress(3, 18, storage, now), false, "approved contract rejects unknown app without sanitizing");
  assert.equal(clearProgress(storage), false);
  assert.equal(storage.getItem(PROGRESS_KEY), unknown);
  storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, apps: { "think-forge": peer } }));
  assert.equal(reportProgress(3, 18, storage, now), true);
  const summary = JSON.parse(storage.getItem(PROGRESS_KEY));
  assert.deepEqual(Object.keys(summary.apps).sort(), ["light-route", "think-forge"]);
  assert.deepEqual(summary.apps["light-route"], { completed: 3, total: 18, updatedAt: instant });
  assert.equal(clearProgress(storage), true);
  assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_KEY)).apps, { "think-forge": summary.apps["think-forge"] });
  for (const [completed, total] of [[0, 18], [-1, 18], [19, 18], [1.5, 18], [1, 1001]]) assert.equal(reportProgress(completed, total, storage, now), false);
  storage.setItem(PROGRESS_KEY, "bad");
  assert.equal(reportProgress(1, 18, storage, now), false);
  assert.equal(storage.getItem(PROGRESS_KEY), "bad");
  for (const entry of [{ completed: 1, total: 18, updatedAt: "2026-02-30T00:00:00.000Z" }, { completed: 20, total: 18, updatedAt: instant }]) {
    storage.setItem(PROGRESS_KEY, JSON.stringify({ version: 1, apps: { "think-forge": entry } }));
    assert.equal(reportProgress(1, 18, storage, now), false);
  }
  assert.equal(reportProgress(1, 18, { getItem() { throw Error("blocked"); } }, now), false);
});

test("byte retention cap evicts oldest replays before local storage exceeds 512KiB", () => {
  let run = createRun(1, "large-legal-replay");
  for (let i = 0; i < 900; i++) run = applyAction(run, { type: "hint" });
  run = finish(run);
  const record = snapshotRun(run);
  const oversized = { ...emptyStore(), last: record, records: Array(MAX_RECORDS).fill(record) };
  assert.ok(new TextEncoder().encode(JSON.stringify(oversized)).length > MAX_STORAGE_BYTES);
  const bounded = boundStore(oversized);
  assert.ok(bounded.records.length < MAX_RECORDS);
  assert.ok(new TextEncoder().encode(JSON.stringify(bounded)).length <= MAX_STORAGE_BYTES);
  assert.deepEqual(bounded.last, record);
  const storage = memoryStorage();
  assert.equal(writeStore(oversized, storage), false);
  assert.equal(writeStore(bounded, storage), true);
});
