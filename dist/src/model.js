import { rng } from "./core.js";
export const N = 8;
export const TITLES = [
  "첫 번째 반사",
  "두 번의 꺾임",
  "높은 곳으로",
  "멀리 돌아가기",
  "거울 사이로",
  "한 줄기, 두 갈래",
  "두 목표를 향해",
  "분기의 방향",
  "다른 색의 문",
  "색과 방향",
  "얽힌 광선",
  "완성된 빛의 길",
];
export function rotatePiece(p) {
  if (!p || !["mirror", "splitter", "filter"].includes(p.type))
    throw new TypeError("Invalid piece");
  return p.type === "filter"
    ? { ...p, color: p.color === "A" ? "C" : "A" }
    : { ...p, turn: p.turn ^ 1 };
}
export function trace(puzzle, pieces = puzzle.pieces) {
  const map = new Map(pieces.map((p) => [p.x + "," + p.y, p])),
    walls = new Set(puzzle.walls.map((p) => p.x + "," + p.y)),
    rays = [{ x: -1, y: puzzle.source.y, dx: 1, dy: 0, color: "A" }],
    seen = new Set(),
    segments = [],
    lit = new Set();
  let loop = false;
  while (rays.length && segments.length < 1024) {
    const ray = rays.pop();
    for (let steps = 0; steps < 256; steps++) {
      const x = ray.x + ray.dx,
        y = ray.y + ray.dy;
      if (x < 0 || x >= N || y < 0 || y >= N) break;
      const key = x + "," + y + "," + ray.dx + "," + ray.dy + "," + ray.color;
      if (seen.has(key)) {
        loop = true;
        break;
      }
      seen.add(key);
      segments.push({ x1: ray.x, y1: ray.y, x2: x, y2: y, color: ray.color });
      ray.x = x;
      ray.y = y;
      if (walls.has(x + "," + y)) break;
      const goal = puzzle.goals.find((g) => g.x === x && g.y === y);
      if (goal) {
        if (goal.color === ray.color) lit.add(x + "," + y);
        break;
      }
      const p = map.get(x + "," + y);
      if (!p) continue;
      if (p.type === "filter") {
        ray.color = p.color;
        continue;
      }
      const dx = p.turn ? ray.dy : -ray.dy,
        dy = p.turn ? ray.dx : -ray.dx;
      if (p.type === "splitter") rays.push({ ...ray, dx, dy });
      else {
        ray.dx = dx;
        ray.dy = dy;
      }
    }
  }
  return {
    segments,
    lit: [...lit],
    solved: lit.size === puzzle.goals.length,
    loop,
  };
}
export function makePuzzle(stage, seed) {
  if (
    !Number.isInteger(stage) ||
    stage < 1 ||
    stage > 12 ||
    typeof seed !== "string" ||
    seed.length > 40
  )
    throw new TypeError("Invalid puzzle");
  const r = rng(seed + "|light-v1|" + stage),
    int = (a, b) => a + Math.floor(r() * (b - a + 1)),
    startY = int(1, 2),
    x1 = int(2, 3),
    bottom = int(5, 6),
    x2 = stage >= 9 ? int(4, 5) : int(5, 6),
    endY = stage >= 6 ? int(2, 3) : int(0, 1);
  const solution =
    stage === 1
      ? [
          { x: x1, y: startY, type: "mirror", turn: 1 },
          { x: x1, y: bottom, type: "mirror", turn: 1 },
        ]
      : [
          { x: x1, y: startY, type: "mirror", turn: 1 },
          { x: x1, y: bottom, type: "mirror", turn: 1 },
          { x: x2, y: bottom, type: "mirror", turn: 0 },
          { x: x2, y: endY, type: stage >= 6 ? "splitter" : "mirror", turn: 0 },
        ];
  if (stage >= 9)
    solution.push({ x: x2 + 1, y: endY, type: "filter", color: "C" });
  const puzzle = {
    stage,
    title: TITLES[stage - 1],
    source: { x: 0, y: startY },
    goals:
      stage === 1
        ? [{ x: 7, y: bottom, color: "A" }]
        : [
            { x: 7, y: endY, color: stage >= 9 ? "C" : "A" },
            ...(stage >= 6 ? [{ x: x2, y: 0, color: "A" }] : []),
          ],
    walls: [],
    pieces: solution.map((p) =>
      p.type === "filter"
        ? { ...p, color: r() < 0.5 ? "A" : "C" }
        : { ...p, turn: r() < 0.5 ? 0 : 1 },
    ),
    solution,
  };
  const path = trace(puzzle, solution);
  if (!path.solved) throw Error("Invalid generated solution");
  const forbidden = new Set(path.segments.map((s) => s.x2 + "," + s.y2));
  forbidden.add("0," + startY);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const key = x + "," + y;
      if (!forbidden.has(key) && r() < 0.18) puzzle.walls.push({ x, y });
    }
  if (trace(puzzle).solved) puzzle.pieces[0] = rotatePiece(puzzle.pieces[0]);
  return puzzle;
}
export function puzzleScore(solved, moves, hints) {
  if (
    !Number.isInteger(moves) ||
    moves < 0 ||
    !Number.isInteger(hints) ||
    hints < 0
  )
    throw new TypeError("Invalid score inputs");
  return solved ? Math.max(20, 1000 - moves * 15 - hints * 120) : 0;
}
