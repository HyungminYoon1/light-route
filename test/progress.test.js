import test from "node:test";
import assert from "node:assert/strict";
import { APP_IDS, PROGRESS_KEY, reportProgress, clearProgress } from "../dist/src/progress.js";
import { SESSION_KEY, writeStore, readStore, clearStore } from "../dist/src/storage.js";
import { createRun, challengePlan, applyAction, runStatus, emptyStore, rememberRun, independentCount } from "../dist/src/session.js";

const instant = "2026-10-13T03:00:00.000Z", now = () => new Date(instant);
const peer = { updatedAt: instant, total: 1000, completed: 0 };
const own = { completed: 1, total: 18, updatedAt: instant };
const summary = (apps, extra = {}) => JSON.stringify({ version: 1, apps, ...extra });
function memory(raw = null) {
  const values = new Map([["other-app-private", "keep exact bytes\r\n한글"]]), writes = [];
  if (raw !== null) values.set(PROGRESS_KEY, raw);
  return {
    values, writes,
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push(["set", key]); values.set(key, value); },
    removeItem: key => { writes.push(["remove", key]); values.delete(key); },
  };
}
function rejectsWithoutWriting(raw, label) {
  for (const [operation, invoke] of [["report", s => reportProgress(1, 18, s, now)], ["clear", clearProgress]]) {
    const storage = memory(raw), before = new Map(storage.values);
    assert.equal(invoke(storage), false, `${label}: ${operation} must reject`);
    assert.deepEqual(storage.values, before, `${label}: exact raw and good peer bytes preserved`);
    assert.deepEqual(storage.writes, [], `${label}: no attempted write or delete`);
  }
}

test("progress: unknown root, app and entry fields block report and clear without sanitizing", () => {
  const cases = [
    ["root extra", summary({ "think-forge": peer }, { extra: "keep" })],
    ["unknown app", summary({ "think-forge": peer, evil: { seed: "private fixture" } })],
    ["entry extra", summary({ "think-forge": { ...peer, seed: "private fixture" } })],
    ["own extra", summary({ "think-forge": peer, "light-route": { ...own, score: 1000 } })],
    ["prototype name", '{"version":1,"apps":{"__proto__":{"completed":1,"total":1,"updatedAt":"'+instant+'"}}}'],
  ];
  for (const [label, raw] of cases) rejectsWithoutWriting(" \r\n" + raw + "\t", label);
});

test("progress: malformed, empty, primitive and wrong-root JSON preserve every byte", () => {
  for (const raw of ["", " \r\n\t", "{", "undefined", "null", "true", "0", '"text"', "[]", "{}",
    '{"version":1}', '{"apps":{}}', '{"version":"1","apps":{}}', '{"version":2,"apps":{}}',
    '{"version":1,"apps":null}', '{"version":1,"apps":[]}', '{"version":1,"apps":""}']) {
    rejectsWithoutWriting(raw, JSON.stringify(raw));
  }
});

test("progress: invalid entries cannot erase a valid peer or repair a corrupt own entry", () => {
  const bad = [null, [], 0, "", {}, { completed: 0, total: 1 },
    ...[-1, 0.5, "0", null, NaN, Infinity].map(completed => ({ ...peer, completed })),
    ...[-1, 0.5, "18", null, 1001, Infinity].map(total => ({ ...peer, total })),
    { ...peer, completed: 2, total: 1 },
    ...["2026-02-30T00:00:00.000Z", "2026-10-13", "2026-10-13T03:00:00Z", 0, null].map(updatedAt => ({ ...peer, updatedAt })),
  ];
  for (const entry of bad) for (const id of ["echo-vault", "light-route"]) {
    rejectsWithoutWriting(summary({ "think-forge": peer, [id]: entry }), `${id} ${JSON.stringify(entry)}`);
  }
});

test("progress: documented 15 IDs, peer boundaries and canonical peer bytes survive own update and clear", () => {
  assert.deepEqual([...APP_IDS].sort(), ["data-mirage", "echo-vault", "light-route", "logic-foundry", "neon-tactics",
    "orbit-courier", "packet-journey", "parcel-panic", "pixel-kitchen", "pocket-city", "route-race", "sense-lab",
    "swarm-garden", "think-forge", "traffic-lab"]);
  const peers = Object.fromEntries(APP_IDS.filter(id => id !== "light-route").map((id, i) =>
    [id, { updatedAt: instant, total: i === 0 ? 0 : 1000, completed: i === 1 ? 1000 : 0 }]));
  const storage = memory(summary(peers));
  for (const completed of [1, 18]) {
    assert.equal(reportProgress(completed, 18, storage, now), true);
    const raw = storage.getItem(PROGRESS_KEY), parsed = JSON.parse(raw);
    assert.equal(Object.keys(parsed.apps).length, 15);
    assert.deepEqual(parsed.apps["light-route"], { ...own, completed });
    for (const [id, entry] of Object.entries(peers)) {
      assert.deepEqual(parsed.apps[id], entry);
      assert.ok(raw.includes(JSON.stringify(id) + ":" + JSON.stringify(entry)), `${id} canonical entry bytes`);
    }
  }
  assert.equal(clearProgress(storage), true);
  assert.equal(storage.getItem(PROGRESS_KEY), summary(peers));
  assert.equal(storage.getItem("other-app-private"), "keep exact bytes\r\n한글");
});

test("progress: absent and valid empty summaries initialize only on report; own-absent clear is a byte-preserving no-op", () => {
  for (const raw of [null, '{ "version": 1, "apps": {} }\r\n', "\n" + summary({ "think-forge": peer })]) {
    const storage = memory(raw), before = new Map(storage.values);
    assert.equal(clearProgress(storage), true);
    assert.deepEqual(storage.values, before, "own-absent clear preserves original bytes or absence");
    assert.deepEqual(storage.writes, [], "own-absent clear must not create or rewrite summary");
    assert.equal(reportProgress(1, 18, storage, now), true);
    assert.deepEqual(JSON.parse(storage.getItem(PROGRESS_KEY)).apps["light-route"], own);
  }
});

test("progress: exact 8KiB payload is accepted and one byte beyond blocks both operations", () => {
  const raw = summary({ "think-forge": peer, "light-route": own });
  const atLimit = raw + " ".repeat(8192 - Buffer.byteLength(raw));
  assert.equal(Buffer.byteLength(atLimit), 8192);
  assert.equal(reportProgress(18, 18, memory(atLimit), now), true);
  assert.equal(clearProgress(memory(atLimit)), true);
  rejectsWithoutWriting(atLimit + " ", "8193 bytes");
  rejectsWithoutWriting(summary({ "think-forge": { ...peer, extra: "한".repeat(2800) } }), "UTF-8 oversize");
});

test("progress: invalid counters and clocks never write or consult an unavailable summary", () => {
  let reads = 0;
  const storage = { getItem() { reads++; throw Error("denied"); } };
  for (const [completed, total] of [[0, 18], [-1, 18], [19, 18], [1.5, 18], ["1", 18], [null, 18],
    [NaN, 18], [Infinity, 18], [1, 0], [1, "18"], [1, 1001], [1, NaN], [1, Infinity]]) {
    assert.equal(reportProgress(completed, total, storage, now), false);
  }
  for (const clock of [() => new Date(NaN), () => { throw Error("clock denied"); }]) {
    assert.equal(reportProgress(1, 18, storage, clock), false);
  }
  assert.equal(reads, 0);
});

test("progress: no-op summary write or own-entry deletion cannot claim success", () => {
  for (const invoke of [s => reportProgress(2, 18, s, now), clearProgress]) {
    const raw = summary({ "think-forge": peer, "light-route": own }), storage = memory(raw);
    storage.setItem = () => {};
    assert.equal(invoke(storage), false, "unconfirmed shared change must fail");
    assert.equal(storage.getItem(PROGRESS_KEY), raw);
    assert.equal(storage.getItem("other-app-private"), "keep exact bytes\r\n한글");
  }
});

test("progress: denied reads, quota and denied readback report failure without touching siblings", () => {
  for (const fault of ["read", "write", "readback"]) for (const invoke of [s => reportProgress(2, 18, s, now), clearProgress]) {
    const raw = summary({ "think-forge": peer, "light-route": own }), storage = memory(raw);
    const get = storage.getItem, set = storage.setItem;
    let wrote = false;
    storage.getItem = key => { if (fault === "read" || fault === "readback" && wrote) throw Error("fixture denied"); return get(key); };
    storage.setItem = (key, value) => { if (fault === "write") throw Error("fixture quota"); set(key, value); wrote = true; };
    assert.equal(invoke(storage), false, fault);
    assert.equal(storage.values.get("other-app-private"), "keep exact bytes\r\n한글");
    if (fault !== "readback") assert.equal(storage.values.get(PROGRESS_KEY), raw);
  }
});

test("progress: repeated identical report and clear do not rewrite confirmed state", () => {
  const storage = memory(summary({ "think-forge": peer, "light-route": own }));
  assert.equal(reportProgress(1, 18, storage, now), true);
  assert.deepEqual(storage.writes, [], "identical confirmed report needs no write");
  assert.equal(clearProgress(storage), true);
  const count = storage.writes.length, raw = storage.getItem(PROGRESS_KEY);
  assert.equal(clearProgress(storage), true);
  assert.equal(storage.writes.length, count);
  assert.equal(storage.getItem(PROGRESS_KEY), raw);
});

test("storage clear: both own deletions require readback; no-op or partial removal cannot claim success", () => {
  for (const ignored of [[SESSION_KEY], ["light-route-v1"], [SESSION_KEY, "light-route-v1"]]) {
    const storage = memory();
    storage.values.set(SESSION_KEY, "private fixture"); storage.values.set("light-route-v1", "legacy fixture");
    const remove = storage.removeItem;
    storage.removeItem = key => { if (!ignored.includes(key)) remove(key); };
    assert.equal(clearStore(storage), false, "unconfirmed private deletion must fail");
    for (const key of ignored) assert.notEqual(storage.getItem(key), null);
    assert.equal(storage.getItem("other-app-private"), "keep exact bytes\r\n한글");
  }
  const storage = memory();
  assert.equal(clearStore(storage), true, "already absent own records are successfully cleared");
  storage.getItem = () => { throw Error("fixture readback denied"); };
  assert.equal(clearStore(storage), false);
});

test("progress: blocked shared state does not prevent durable private completion, resume or own-only clear", () => {
  const raw = " \n" + summary({ "think-forge": peer, evil: { fixture: true } }), storage = memory(raw);
  let run = createRun(18, "qa-0", "limited");
  for (const index of challengePlan(run.puzzle).rotations) run = applyAction(run, { type: "rotate", index });
  assert.equal(runStatus(run), "complete");
  const store = rememberRun(emptyStore(), run);
  assert.equal(writeStore(store, storage), true);
  assert.equal(reportProgress(independentCount(store), 18, storage, now), false);
  assert.deepEqual(readStore(storage), store);
  assert.equal(independentCount(readStore(storage)), 1);
  assert.equal(storage.getItem(PROGRESS_KEY), raw);
  assert.equal(clearStore(storage), true);
  assert.equal(clearProgress(storage), false);
  assert.equal(storage.getItem(SESSION_KEY), null);
  assert.equal(storage.getItem(PROGRESS_KEY), raw);
  assert.equal(storage.getItem("other-app-private"), "keep exact bytes\r\n한글");
});
