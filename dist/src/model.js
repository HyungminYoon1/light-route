import { rng, cleanSeed, shuffle } from "./core.js";

export const N = 8;
export const VERSION = "light-v2";
export const TRACE_LIMIT = N * N * 4 * 2;
export const GENERATION_LIMIT = 128;
export const CAMPAIGN = [
  { name: "반사의 설계", rule: "거울을 바꿔 목표에 빛을 연결하세요." },
  { name: "필수 경유지", rule: "목표와 ◇ 경유지를 모두 켜세요." },
  { name: "분기 회로", rule: "분기를 이용해 모든 목표를 동시에 켜세요." },
  { name: "색의 순서", rule: "목표와 경유지의 A/C 색을 맞추세요." },
  { name: "안전한 빛", rule: "목표와 경유지를 켜고 × 센서를 피하세요." },
  { name: "마스터 회로", rule: "네 목표와 경유지를 켜고 × 센서를 피하세요. 고정 거울은 변경할 수 없습니다." },
];
export const TITLES = [
  "네 번의 방향 전환", "지그재그 우회", "길어진 반사",
  "놓칠 수 없는 경유지", "세 개의 이정표", "모든 길을 확인하기",
  "나누어진 빛", "두 갈래의 긴 여정", "세 목표의 교차로",
  "색이 바뀌는 지점", "경유지에도 맞는 색", "세 가지 도착 조건",
  "피해야 하는 빛", "안전한 세 갈래", "정확한 분기",
  "네 개의 목적지", "잠긴 거울의 단서", "빛의 미궁 설계자",
];
const key = (p) => `${p.x},${p.y}`;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const sameSetting = (a, b) => a.type === "filter" ? a.color === b.color : a.turn === b.turn;

export function rotatePiece(p) {
  if (!p || !["mirror", "splitter", "filter"].includes(p.type)) throw new TypeError("Invalid piece");
  if (p.fixed) return { ...p };
  return p.type === "filter" ? { ...p, color: p.color === "A" ? "C" : "A" } : { ...p, turn: p.turn ^ 1 };
}

export function trace(puzzle, pieces = puzzle.pieces) {
  const map = new Map(pieces.map((p) => [key(p), p]));
  const walls = new Set(puzzle.walls.map(key));
  const goals = new Map(puzzle.goals.map((p) => [key(p), p]));
  const checkpoints = new Map((puzzle.checkpoints ?? []).map((p) => [key(p), p]));
  const hazards = new Set((puzzle.hazards ?? []).map(key));
  const dx = puzzle.source.dx ?? 1;
  const rays = [{ x: (puzzle.source.x ?? 0) - dx, y: puzzle.source.y, dx, dy: 0, color: "A", ancestry: new Set() }];
  const seen = new Set(), segments = [], lit = new Set(), visited = new Set(), triggered = new Set(), wrongColor = new Set();
  let loop = false, truncated = false;
  while (rays.length) {
    const ray = rays.pop();
    while (true) {
      const x = ray.x + ray.dx, y = ray.y + ray.dy;
      if (x < 0 || x >= N || y < 0 || y >= N) break;
      const state = `${x},${y},${ray.dx},${ray.dy},${ray.color}`;
      if (ray.ancestry.has(state)) { loop = true; break; }
      if (seen.has(state)) break;
      if (segments.length >= TRACE_LIMIT) { truncated = true; break; }
      seen.add(state);
      ray.ancestry.add(state);
      segments.push({ x1: ray.x, y1: ray.y, x2: x, y2: y, color: ray.color });
      ray.x = x;
      ray.y = y;
      const cell = `${x},${y}`;
      if (walls.has(cell)) break;
      if (hazards.has(cell)) { triggered.add(cell); break; }
      const checkpoint = checkpoints.get(cell);
      if (checkpoint) {
        if (!checkpoint.color || checkpoint.color === ray.color) visited.add(cell);
        else wrongColor.add(cell);
      }
      const goal = goals.get(cell);
      if (goal) {
        if (goal.color === ray.color) lit.add(cell);
        else wrongColor.add(cell);
        break;
      }
      const p = map.get(cell);
      if (!p) continue;
      if (p.type === "filter") { ray.color = p.color; continue; }
      const reflected = { dx: p.turn ? ray.dy : -ray.dy, dy: p.turn ? ray.dx : -ray.dx };
      if (p.type === "splitter") rays.push({ ...ray, ...reflected, ancestry: new Set(ray.ancestry) });
      else Object.assign(ray, reflected);
    }
  }
  return {
    segments, lit: [...lit], visited: [...visited], triggered: [...triggered], wrongColor: [...wrongColor],
    solved: goals.size > 0 && lit.size === goals.size && visited.size === checkpoints.size && !triggered.size && !truncated,
    loop, truncated,
  };
}

// A bounded random walk builds a tree on a 4×4 lattice. Edge midpoints
// remain available for converters and checkpoints; no path can intersect itself.
function growRoute(random, start, length, occupied, firstDirection) {
  const path = [start];
  while (path.length < length) {
    const last = path.at(-1);
    const candidates = shuffle(directions, random).filter(([dx, dy]) => {
      if (path.length === 1 && firstDirection && (dx !== firstDirection[0] || dy !== firstDirection[1])) return false;
      const next = { x: last.x + dx, y: last.y + dy };
      return next.x >= 0 && next.x < 4 && next.y >= 0 && next.y < 4 && !occupied.has(key(next));
    });
    if (!candidates.length) return null;
    const [dx, dy] = candidates[0];
    const next = { x: last.x + dx, y: last.y + dy };
    occupied.add(key(next));
    path.push(next);
  }
  return path;
}

function buildTree(random, length, targetCount) {
  const start = { x: 0, y: Math.floor(random() * 4) };
  const occupied = new Set([key(start)]);
  const main = growRoute(random, start, length, occupied);
  if (!main) return null;
  const paths = [main], split = [];
  for (let branch = 1; branch < targetCount; branch++) {
    const candidates = [];
    for (const path of paths) for (let i = 0; i < path.length - 1; i++) {
      const p = path[i], previous = i ? path[i - 1] : path === main ? { x: -1, y: start.y } : null;
      if (!previous || split.some((s) => key(s) === key(p))) continue;
      const dx = p.x - previous.x, dy = p.y - previous.y;
      const next = path[i + 1];
      if ((next.x - p.x) * dx + (next.y - p.y) * dy !== 0) continue;
      const straight = { x: p.x + dx, y: p.y + dy };
      if (straight.x < 0 || straight.x > 3 || straight.y < 0 || straight.y > 3 || occupied.has(key(straight))) continue;
      candidates.push({ p, dx, dy });
    }
    let added = false;
    for (const { p, dx, dy } of shuffle(candidates, random)) {
      const trial = new Set(occupied);
      const route = growRoute(random, p, targetCount === 2 ? 4 : 3, trial, [dx, dy]);
      if (!route) continue;
      for (const cell of trial) occupied.add(cell);
      paths.push(route);
      split.push(p);
      added = true;
      break;
    }
    if (!added) return null;
  }
  return { paths, split };
}

function piecesFromTree(tree) {
  const pieces = [], edges = [], goals = [];
  for (const [index, path] of tree.paths.entries()) {
    goals.push({ ...path.at(-1), color: "A" });
    for (let i = 0; i < path.length - 1; i++) {
      const p = path[i], next = path[i + 1];
      edges.push({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2, terminal: i === path.length - 2 });
      if (i === 0 && index > 0) continue;
      const previous = i ? path[i - 1] : { x: -1, y: p.y };
      const dx = p.x - previous.x, dy = p.y - previous.y, outX = next.x - p.x, outY = next.y - p.y;
      if (dx === outX && dy === outY) continue;
      pieces.push({ ...p, type: tree.split.some((s) => key(s) === key(p)) ? "splitter" : "mirror", turn: outX === dy && outY === dx ? 1 : 0 });
    }
  }
  return { pieces, edges, goals };
}

// Finite verified fallback trees for each target count, also tested without RNG search.
const FALLBACKS = [
  { paths: [[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2]]], split: [] },
  { paths: [[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2]], [[1, 1], [2, 1], [2, 0], [3, 0]]], split: [[1, 1]] },
  { paths: [[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2]], [[1, 1], [2, 1], [2, 0]], [[1, 2], [1, 3], [0, 3]]], split: [[1, 1], [1, 2]] },
  { paths: [[[0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3], [3, 2]], [[1, 1], [2, 1], [3, 1]], [[1, 2], [1, 3], [0, 3]], [[0, 0], [1, 0], [2, 0]]], split: [[1, 1], [1, 2], [0, 0]] },
];

function fallbackTree(targets, length) {
  const data = FALLBACKS[targets - 1];
  return {
    paths: data.paths.map((path, i) => (targets === 1 && i === 0 ? path.slice(0, length) : path).map(([x, y]) => ({ x, y }))),
    split: data.split.map(([x, y]) => ({ x, y })),
  };
}

export function makePuzzle(stage, seed, { attempts = GENERATION_LIMIT } = {}) {
  if (!Number.isInteger(stage) || stage < 1 || stage > TITLES.length || !Number.isInteger(attempts) || attempts < 0 || attempts > GENERATION_LIMIT) throw new TypeError("Invalid puzzle");
  seed = cleanSeed(seed);
  const random = rng(`${seed}|${VERSION}|${stage}`), tier = Math.floor((stage - 1) / 3);
  const targetCount = stage >= 16 ? 4 : stage >= 12 || stage === 9 ? 3 : stage >= 7 ? 2 : 1;
  const length = tier === 0 ? 6 + (stage - 1) : 8;
  const minTurns = tier === 0 ? 4 + stage - 1 : Math.min(8, targetCount + 5);
  let tree, attemptsUsed = 0;
  for (; attemptsUsed < attempts; attemptsUsed++) {
    const candidate = buildTree(random, length, targetCount);
    if (candidate && piecesFromTree(candidate).pieces.length >= minTurns) { tree = candidate; attemptsUsed++; break; }
  }
  const fallback = !tree;
  tree ??= fallbackTree(targetCount, length);
  const raw = piecesFromTree(tree), offset = random() < 0.5 ? 0 : 1, flip = random() < 0.5;
  const project = (p) => ({ ...p, x: flip ? 6 - p.x * 2 : 1 + p.x * 2, y: offset + p.y * 2, ...(p.turn === undefined ? {} : { turn: p.turn ^ Number(flip) }) });
  const solution = raw.pieces.map(project), edges = raw.edges.map(project);
  const puzzle = {
    stage, version: VERSION, tier, title: TITLES[stage - 1],
    source: { x: flip ? 7 : 0, y: offset + tree.paths[0][0].y * 2, dx: flip ? -1 : 1 },
    goals: raw.goals.map(project), checkpoints: [], hazards: [], walls: [], pieces: [], solution,
    generation: { attempts: attemptsUsed, fallback },
  };
  if (tier >= 3) {
    edges.filter((p) => p.terminal).forEach((p, i) => solution.push({ x: p.x, y: p.y, type: "filter", color: i % 2 ? "A" : "C" }));
    const upstream = edges.find((p) => !p.terminal);
    if (upstream) solution.push({ x: upstream.x, y: upstream.y, type: "filter", color: "C" });
  }
  let witness = trace(puzzle, solution);
  for (const goal of puzzle.goals) goal.color = witness.segments.find((s) => s.x2 === goal.x && s.y2 === goal.y)?.color ?? "A";
  const occupied = new Set([...solution, ...puzzle.goals, puzzle.source].map(key));
  if (tier >= 1) {
    const candidates = shuffle(edges.filter((p) => !occupied.has(key(p))), random);
    const checkpointCount = tier === 1 ? Math.min(3, stage - 2) : Math.min(4, tier + 1);
    for (const p of candidates.slice(0, checkpointCount)) {
      const arrival = witness.segments.find((s) => s.x2 === p.x && s.y2 === p.y);
      puzzle.checkpoints.push({ x: p.x, y: p.y, ...(tier >= 3 ? { color: arrival.color } : {}) });
      occupied.add(key(p));
    }
  }
  if (tier === 5) {
    const mirrors = solution.filter((p) => p.type === "mirror");
    for (const p of shuffle(mirrors, random).slice(0, stage - 16)) p.fixed = true;
  }
  witness = trace(puzzle, solution);
  const reserved = new Set([...witness.segments.map((s) => `${s.x2},${s.y2}`), ...occupied]);
  const empty = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!reserved.has(`${x},${y}`)) empty.push({ x, y });
  const extras = shuffle(empty, random);
  // Distractors are real rotatable optics, not extra mandatory hint steps.
  for (const p of extras.splice(0, 1 + Math.min(4, tier))) solution.push({ ...p, type: tier >= 2 && random() < 0.35 ? "splitter" : "mirror", turn: random() < 0.5 ? 0 : 1, decoy: true });
  if (tier >= 4) {
    const exposed = new Map();
    for (let i = 0; i < solution.length; i++) {
      const trial = solution.map((p, j) => i === j ? rotatePiece(p) : p);
      for (const [distance, s] of trace(puzzle, trial).segments.entries()) {
        const cell = `${s.x2},${s.y2}`;
        exposed.set(cell, Math.min(exposed.get(cell) ?? Infinity, distance));
      }
    }
    // Nearest exposed cells come first, so later walls cannot screen every sensor.
    extras.sort((a, b) => (exposed.get(key(a)) ?? 1000) - (exposed.get(key(b)) ?? 1000));
    puzzle.hazards = extras.splice(0, tier === 5 ? 4 : 3);
  }
  puzzle.walls = extras.filter(() => random() < 0.16);
  puzzle.pieces = solution.map((p) => p.fixed || random() < 0.25 ? { ...p } : rotatePiece(p));
  const active = solution.map((p, i) => !p.decoy && !p.fixed ? i : -1).filter((i) => i >= 0);
  for (const i of active.slice(0, Math.min(active.length, 3 + tier))) puzzle.pieces[i] = rotatePiece(solution[i]);
  if (!trace(puzzle, solution).solved) throw Error("Invalid generated solution");
  for (const i of active) {
    if (!trace(puzzle).solved) break;
    puzzle.pieces[i] = rotatePiece(puzzle.pieces[i]);
  }
  if (trace(puzzle).solved) throw Error("Invalid solved starting board");
  return puzzle;
}

export function nextHint(puzzle, pieces) {
  if (trace(puzzle, pieces).solved) return -1;
  return pieces.findIndex((p, i) => !p.fixed && !p.decoy && !sameSetting(p, puzzle.solution[i]));
}

export function puzzleScore(solved, moves, hints) {
  if (!Number.isInteger(moves) || moves < 0 || !Number.isInteger(hints) || hints < 0) throw new TypeError("Invalid score inputs");
  return solved ? Math.max(20, 1000 - moves * 15 - hints * 120) : 0;
}
