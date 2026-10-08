import test from "node:test";
import assert from "node:assert/strict";
import {
  makePuzzle,
  trace,
  rotatePiece,
  puzzleScore,
} from "../dist/src/model.js";
test("240 puzzles have reachable targets and start unsolved", () => {
  for (let stage = 1; stage <= 12; stage++)
    for (let i = 0; i < 20; i++) {
      const p = makePuzzle(stage, "p-" + i);
      assert.deepEqual(p, makePuzzle(stage, "p-" + i));
      assert.ok(trace(p, p.solution).solved);
      assert.ok(!trace(p).solved);
      assert.ok(trace(p).segments.length <= 1024);
    }
});
test("rotation twice returns original and filter flips", () => {
  const p = { x: 1, y: 1, type: "mirror", turn: 0 };
  assert.deepEqual(rotatePiece(rotatePiece(p)), p);
  assert.equal(rotatePiece({ type: "filter", color: "A" }).color, "C");
});
test("scores and configuration bounds", () => {
  assert.equal(puzzleScore(false, 0, 0), 0);
  assert.ok(puzzleScore(true, 1, 0) > puzzleScore(true, 1, 1));
  assert.throws(() => makePuzzle(13, "a"));
  assert.throws(() => puzzleScore(true, -1, 0));
});
test("looping beam terminates", () => {
  const p = {
    source: { y: 0 },
    walls: [],
    goals: [{ x: 7, y: 7, color: "A" }],
    pieces: [
      { x: 1, y: 0, type: "mirror", turn: 1 },
      { x: 1, y: 1, type: "mirror", turn: 0 },
      { x: 0, y: 1, type: "mirror", turn: 1 },
      { x: 0, y: 0, type: "mirror", turn: 0 },
    ],
  };
  const r = trace(p);
  assert.ok(!r.solved);
  assert.ok(r.segments.length < 100);
});
