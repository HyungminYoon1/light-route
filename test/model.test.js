import test from "node:test";
import assert from "node:assert/strict";
import { N, TITLES, TRACE_LIMIT, GENERATION_LIMIT, makePuzzle, trace, rotatePiece, puzzleScore, nextHint } from "../dist/src/model.js";

const cellKey = ({ x, y }) => `${x},${y}`;
const sorted = (values) => [...values].sort();
const fixture = (overrides = {}) => ({ source: { x: 0, y: 3, dx: 1 }, pieces: [], walls: [], checkpoints: [], hazards: [], goals: [{ x: 7, y: 3, color: "A" }], ...overrides });

// Independent oracle: breadth-first graph traversal, compass-index reflection
// tables, and one-cell transitions. Does not use the production trace or rotation.
function referenceTrace(puzzle, pieces) {
  const delta = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const reflection = [[1, 0, 3, 2], [3, 2, 1, 0]];
  const direction = puzzle.source.dx === -1 ? 3 : 1;
  const queue = [[puzzle.source.x ?? 0, puzzle.source.y, direction, "A"]];
  const seen = new Set(), lit = new Set(), visited = new Set(), triggered = new Set();
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const [x, y, d, color] = queue[cursor];
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const state = [x, y, d, color].join(":");
    if (seen.has(state)) continue;
    seen.add(state);
    assert.ok(seen.size <= TRACE_LIMIT, "finite state space");
    const at = (p) => p.x === x && p.y === y;
    if (puzzle.walls.some(at)) continue;
    if (puzzle.hazards.some(at)) { triggered.add(`${x},${y}`); continue; }
    const checkpoint = puzzle.checkpoints.find(at);
    if (checkpoint && (!checkpoint.color || checkpoint.color === color)) visited.add(`${x},${y}`);
    const goal = puzzle.goals.find(at);
    if (goal) { if (goal.color === color) lit.add(`${x},${y}`); continue; }
    const piece = pieces.find(at);
    const outgoing = piece && piece.type !== "filter" ? (piece.type === "splitter" ? [d, reflection[piece.turn][d]] : [reflection[piece.turn][d]]) : [d];
    for (const next of outgoing) queue.push([x + delta[next][0], y + delta[next][1], next, piece?.type === "filter" ? piece.color : color]);
  }
  return { lit: sorted(lit), visited: sorted(visited), triggered: sorted(triggered) };
}

test("1,800 deterministic campaign boards: independent reachability, valid cells, unsolved starts", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) for (let i = 0; i < 100; i++) {
    const p = makePuzzle(stage, "qa-" + i);
    assert.deepEqual(p, makePuzzle(stage, "qa-" + i));
    assert.ok(p.generation.attempts <= GENERATION_LIMIT);
    const occupants = [p.source, ...p.pieces, ...p.goals, ...p.checkpoints, ...p.hazards, ...p.walls];
    assert.equal(new Set(occupants.map(cellKey)).size, occupants.length, `no overlapping occupants: ${stage}/${i}`);
    for (const cell of occupants) assert.ok(Number.isInteger(cell.x) && Number.isInteger(cell.y) && cell.x >= 0 && cell.y >= 0 && cell.x < N && cell.y < N);
    for (const configuration of [p.solution, p.pieces, p.pieces.map(rotatePiece)]) {
      const actual = trace(p, configuration), expected = referenceTrace(p, configuration);
      for (const field of ["lit", "visited", "triggered"]) assert.deepEqual(sorted(actual[field]), expected[field], `${stage}/${i}/${field}`);
      assert.equal(actual.solved, expected.lit.length === p.goals.length && expected.visited.length === p.checkpoints.length && expected.triggered.length === 0);
      assert.ok(actual.segments.length <= TRACE_LIMIT);
      assert.equal(actual.truncated, false);
    }
    const solution = referenceTrace(p, p.solution);
    assert.equal(solution.lit.length, p.goals.length);
    assert.equal(solution.visited.length, p.checkpoints.length);
    assert.equal(solution.triggered.length, 0);
    assert.ok(!trace(p).solved);
  }
});

test("all 18 fallback stages are reachable without any random search", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) for (let i = 0; i < 8; i++) {
    const p = makePuzzle(stage, "fallback-" + i, { attempts: 0 });
    assert.deepEqual(p.generation, { attempts: 0, fallback: true });
    const result = referenceTrace(p, p.solution);
    assert.equal(result.lit.length, p.goals.length);
    assert.equal(result.visited.length, p.checkpoints.length);
    assert.equal(result.triggered.length, 0);
    assert.ok(!trace(p).solved);
    const occupants = [p.source, ...p.pieces, ...p.goals, ...p.checkpoints, ...p.hazards, ...p.walls];
    assert.equal(new Set(occupants.map(cellKey)).size, occupants.length);
  }
});

test("difficulty contracts and topology diversity across every tier", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) {
    const topologies = new Set();
    for (let i = 0; i < 64; i++) {
      const p = makePuzzle(stage, "variety-" + i);
      topologies.add(JSON.stringify(p.solution.filter((piece) => !piece.decoy).map(({ x, y, type }) => [x, y, type])));
      assert.ok(p.solution.filter((piece) => !piece.decoy).length >= (stage >= 16 ? 13 : stage >= 10 ? 10 : stage >= 7 ? 7 : stage >= 3 ? 6 : stage + 3));
      assert.ok(p.pieces.some((piece) => piece.decoy));
      assert.equal(p.goals.length, stage >= 16 ? 4 : stage >= 12 || stage === 9 ? 3 : stage >= 7 ? 2 : 1);
      assert.equal(p.checkpoints.length, stage < 4 ? 0 : stage === 4 ? 2 : stage < 10 ? 3 : 4);
      if (stage >= 10) assert.deepEqual(sorted(new Set(p.goals.map((g) => g.color))), ["A", "C"]);
      if (stage >= 13) {
        assert.ok(p.hazards.length >= 3);
        assert.ok(p.solution.some((_, j) => trace(p, p.solution.map((piece, k) => j === k ? rotatePiece(piece) : piece)).triggered.length > 0), "a wrong turn can actually trigger a sensor");
      }
      assert.equal(p.pieces.filter((piece) => piece.fixed).length, Math.max(0, stage - 16));
    }
    assert.ok(topologies.size >= 50, `stage ${stage}: ${topologies.size}/64 distinct layouts`);
  }
});

test("hint-only recovery solves 360 boards, skips decoys and fixed pieces, and does not mutate puzzle", () => {
  for (let stage = 1; stage <= TITLES.length; stage++) for (let i = 0; i < 20; i++) {
    const p = makePuzzle(stage, "hint-" + i), original = structuredClone(p);
    const pieces = p.pieces.map((piece) => piece.decoy ? rotatePiece(piece) : { ...piece });
    for (let step = 0; step <= pieces.length; step++) {
      const index = nextHint(p, pieces);
      if (index < 0) break;
      assert.ok(!pieces[index].fixed && !pieces[index].decoy);
      pieces[index] = rotatePiece(pieces[index]);
    }
    assert.ok(trace(p, pieces).solved, `hint recovery ${stage}/${i}`);
    assert.equal(nextHint(p, pieces), -1);
    assert.deepEqual(p, original);
  }
});

test("mirrors reflect all four incoming directions in both orientations", () => {
  const cases = [
    { source: { x: 0, y: 3, dx: 1 }, before: [], at: { x: 3, y: 3 }, goals: [[3, 0], [3, 7]] },
    { source: { x: 7, y: 3, dx: -1 }, before: [], at: { x: 3, y: 3 }, goals: [[3, 7], [3, 0]] },
    { source: { x: 0, y: 6, dx: 1 }, before: [{ x: 1, y: 6, type: "mirror", turn: 0 }], at: { x: 1, y: 3 }, goals: [[7, 3], [0, 3]] },
    { source: { x: 0, y: 0, dx: 1 }, before: [{ x: 1, y: 0, type: "mirror", turn: 1 }], at: { x: 1, y: 3 }, goals: [[0, 3], [7, 3]] },
  ];
  for (const scenario of cases) for (const turn of [0, 1]) {
    const [x, y] = scenario.goals[turn];
    const p = fixture({ source: scenario.source, pieces: [...scenario.before, { ...scenario.at, type: "mirror", turn }], goals: [{ x, y, color: "A" }] });
    assert.ok(trace(p).solved);
  }
});

test("splitters retain the straight beam, reflected branches and simultaneous targets", () => {
  const p = fixture({ pieces: [{ x: 3, y: 3, type: "splitter", turn: 1 }], goals: [{ x: 7, y: 3, color: "A" }, { x: 3, y: 7, color: "A" }] });
  assert.equal(trace(p).lit.length, 2);
  assert.ok(trace(p).solved);
  assert.equal(trace(p, p.pieces.map(rotatePiece)).lit.length, 1);
  assert.ok(!trace(p, p.pieces.map(rotatePiece)).solved);
});

test("a hazard prevents completion even when every target is lit", () => {
  const p = fixture({ pieces: [{ x: 3, y: 3, type: "splitter", turn: 1 }], hazards: [{ x: 3, y: 5 }] });
  const r = trace(p);
  assert.equal(r.lit.length, 1);
  assert.deepEqual(r.triggered, ["3,5"]);
  assert.ok(!r.solved);
  assert.ok(trace({ ...p, hazards: [] }).solved);
});

test("checkpoints pass light through, but missing or wrong-color checkpoints block completion", () => {
  const p = fixture({ checkpoints: [{ x: 2, y: 3, color: "C" }], pieces: [{ x: 5, y: 3, type: "filter", color: "C" }], goals: [{ x: 7, y: 3, color: "C" }] });
  assert.equal(trace(p).lit.length, 1);
  assert.equal(trace(p).visited.length, 0);
  assert.ok(!trace(p).solved);
  assert.deepEqual(trace(p).wrongColor, ["2,3"]);
  assert.ok(trace({ ...p, pieces: [{ x: 1, y: 3, type: "filter", color: "C" }] }).solved);
  assert.ok(!trace({ ...p, checkpoints: [{ x: 2, y: 1 }] }).solved);
  assert.ok(trace({ ...p, checkpoints: [{ x: 2, y: 3 }] }).solved);
});

test("walls, absorbing goals, and color converters have distinct semantics", () => {
  assert.equal(trace(fixture({ walls: [{ x: 2, y: 3 }] })).lit.length, 0);
  assert.equal(trace(fixture({ goals: [{ x: 2, y: 3, color: "A" }, { x: 7, y: 3, color: "A" }] })).lit.length, 1);
  assert.ok(!trace(fixture({ pieces: [{ x: 2, y: 3, type: "filter", color: "C" }] })).solved);
  assert.ok(trace(fixture({ pieces: [{ x: 2, y: 3, type: "filter", color: "C" }, { x: 4, y: 3, type: "filter", color: "A" }] })).solved);
  assert.ok(!trace(fixture({ goals: [] })).solved);
});

test("genuine splitter cycles terminate and are flagged", () => {
  const p = fixture({ source: { x: 0, y: 1, dx: 1 }, pieces: [
    { x: 1, y: 1, type: "splitter", turn: 0 },
    { x: 4, y: 1, type: "mirror", turn: 1 },
    { x: 4, y: 4, type: "mirror", turn: 0 },
    { x: 1, y: 4, type: "mirror", turn: 1 },
  ] });
  const r = trace(p);
  assert.ok(r.loop);
  assert.ok(r.segments.length < 100);
});

test("acyclic beams merging at a splitter are not mislabeled as a loop", () => {
  const p = fixture({ source: { x: 0, y: 4, dx: 1 }, pieces: [
    { x: 1, y: 4, type: "splitter", turn: 0 },
    { x: 5, y: 4, type: "mirror", turn: 0 },
    { x: 1, y: 1, type: "mirror", turn: 0 },
    { x: 5, y: 1, type: "splitter", turn: 0 },
  ], goals: [{ x: 7, y: 1, color: "A" }, { x: 5, y: 0, color: "A" }] });
  assert.ok(trace(p).solved);
  assert.equal(trace(p).loop, false);
});

test("dense splitter boards stay within a finite state bound", () => {
  const p = fixture({ pieces: Array.from({ length: 64 }, (_, i) => ({ x: i % 8, y: Math.floor(i / 8), type: "splitter", turn: i % 2 })) });
  assert.ok(trace(p).segments.length <= TRACE_LIMIT);
});

test("rotation is reversible, fixed optics stay fixed, and scores/input limits hold", () => {
  for (const type of ["mirror", "splitter", "filter"]) {
    const p = type === "filter" ? { type, color: "A" } : { type, turn: 0 };
    assert.deepEqual(rotatePiece(rotatePiece(p)), p);
    assert.deepEqual(rotatePiece({ ...p, fixed: true }), { ...p, fixed: true });
  }
  assert.equal(puzzleScore(false, 0, 0), 0);
  assert.equal(puzzleScore(true, 2, 1), 850);
  assert.equal(puzzleScore(true, 999, 99), 20);
  for (const stage of [0, 19, 1.5, NaN]) assert.throws(() => makePuzzle(stage, "a"));
  for (const seed of ["", " ", "a/b", "<script>", "가", "x".repeat(41), null]) assert.throws(() => makePuzzle(1, seed));
  for (const attempts of [-1, 129, 0.5]) assert.throws(() => makePuzzle(1, "a", { attempts }));
  assert.throws(() => puzzleScore(true, -1, 0));
  assert.throws(() => puzzleScore(true, 0, 0.5));
  assert.throws(() => rotatePiece({ type: "wall" }));
});
