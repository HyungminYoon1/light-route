import {
  $,
  freshSeed,
  cleanSeed,
  loadLocal,
  saveLocal,
  announce,
  tool,
} from "./core.js";
import {
  N,
  TITLES,
  CAMPAIGN,
  VERSION,
  makePuzzle,
  rotatePiece,
  trace,
  puzzleScore,
  nextHint,
} from "./model.js";
const KEY = "light-route-v1";
let saved = loadLocal(KEY, {}),
  best =
    saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
let seed = freshSeed(),
  stage = 1,
  puzzle,
  pieces,
  moves = 0,
  hints = 0,
  history = [],
  completed = false,
  highlight = -1;
const ctx = $("rays").getContext("2d");
const recordKey = (level = stage) => VERSION + "|" + seed + "-" + level;
const coordinate = (x, y) => `${y + 1}행 ${x + 1}열`;
function opticIcon(piece) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  svg.classList.add("optic");
  const line = document.createElementNS(ns, "line");
  for (const [name, value] of Object.entries({ x1: 10, y1: piece.turn ? 10 : 38, x2: 38, y2: piece.turn ? 38 : 10 })) line.setAttribute(name, value);
  svg.append(line);
  if (piece.type === "splitter") {
    const ring = document.createElementNS(ns, "circle");
    for (const [name, value] of Object.entries({ cx: 24, cy: 24, r: 17 })) ring.setAttribute(name, value);
    svg.append(ring);
  }
  return svg;
}
function save() {
  while (Object.keys(best).length > 120) delete best[Object.keys(best)[0]];
  if (!saveLocal(KEY, best))
    announce("이 브라우저에 기록을 저장할 수 없습니다.");
}
function start() {
  puzzle = makePuzzle(stage, seed);
  pieces = puzzle.pieces.map((p) => ({ ...p }));
  moves = 0;
  hints = 0;
  history = [];
  completed = false;
  highlight = -1;
  $("seed").value = seed;
  $("stage-number").textContent =
    "EXPERIMENT " + String(stage).padStart(2, "0") + " / " + TITLES.length;
  $("stage-title").textContent = puzzle.title;
  $("chapter-title").textContent = `${puzzle.tier + 1}장 · ${CAMPAIGN[puzzle.tier].name}`;
  $("mission").textContent = CAMPAIGN[puzzle.tier].rule;
  $("mission-detail").textContent = `목표 ${puzzle.goals.length}개 · 경유지 ${puzzle.checkpoints.length}개` + (puzzle.hazards.length ? ` · 금지 센서 ${puzzle.hazards.length}개는 꺼 두기` : "") + (pieces.some((p) => p.fixed) ? " · 고정 거울 포함" : "");
  $("result").hidden = true;
  $("next").hidden = true;
  announce("");
  render();
}
function render() {
  const focusedPiece = document.activeElement?.dataset.piece;
  const focusedStage = document.activeElement?.dataset.stage;
  const result = trace(puzzle, pieces);
  $("moves").textContent = String(moves).padStart(2, "0");
  $("targets").textContent =
    "목표 " + result.lit.length + " / " + puzzle.goals.length;
  $("constraints").textContent = `경유지 ${result.visited.length} / ${puzzle.checkpoints.length}` + (puzzle.hazards.length ? ` · 금지 센서 ${result.triggered.length}개 작동` : "");
  $("constraints").classList.toggle("warning", result.triggered.length > 0);
  $("best").textContent = best[recordKey()]
    ? best[recordKey()] + " PT"
    : "—";
  const cleared = TITLES.filter((_, i) => best[recordKey(i + 1)]).length;
  $("campaign-progress").textContent = `이 코드에서 ${cleared} / ${TITLES.length} 완료`;
  $("campaign-meter").value = cleared;
  $("levels").replaceChildren(
    ...TITLES.map((t, i) => {
      const b = document.createElement("button");
      b.className =
        "level" +
        (stage === i + 1 ? " current" : "") +
        (best[recordKey(i + 1)] ? " solved" : "");
      b.dataset.stage = i + 1;
      b.textContent = String(i + 1).padStart(2, "0");
      b.setAttribute("aria-label", `${i + 1}단계 ${t}, ${CAMPAIGN[Math.floor(i / 3)].name}` + (best[recordKey(i + 1)] ? ", 완료" : ""));
      b.title = `${CAMPAIGN[Math.floor(i / 3)].name} · ${t}`;
      b.setAttribute("aria-pressed", String(stage === i + 1));
      b.onclick = () => {
        stage = i + 1;
        start();
      };
      return b;
    }),
  );
  $("board").replaceChildren();
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const i = pieces.findIndex((p) => p.x === x && p.y === y),
        piece = pieces[i],
        goal = puzzle.goals.find((g) => g.x === x && g.y === y),
        checkpoint = puzzle.checkpoints.find((g) => g.x === x && g.y === y),
        hazard = puzzle.hazards.some((g) => g.x === x && g.y === y),
        wall = puzzle.walls.some((w) => w.x === x && w.y === y),
        cell = document.createElement(piece ? "button" : "div");
      cell.className = "cell";
      if (piece) {
        cell.classList.add(piece.type);
        cell.dataset.piece = i;
        if (piece.type === "filter") {
          cell.textContent = piece.color;
          cell.classList.toggle("amber", piece.color === "A");
        } else cell.append(opticIcon(piece));
        if (piece.fixed) {
          const badge = document.createElement("small");
          badge.className = "locked";
          badge.textContent = "고정";
          cell.append(badge);
          cell.classList.add("fixed");
        }
        cell.setAttribute(
          "aria-label",
          y +
            1 +
            "행 " +
            (x + 1) +
            "열 " +
            (piece.type === "filter"
              ? "색 변환기 " + piece.color
              : piece.type === "splitter"
                ? "광선 분기 " + (piece.turn ? "왼쪽 위에서 오른쪽 아래" : "왼쪽 아래에서 오른쪽 위")
                : "거울 " + (piece.turn ? "왼쪽 위에서 오른쪽 아래" : "왼쪽 아래에서 오른쪽 위")) + (piece.fixed ? ", 고정, 회전 불가" : ", 눌러 변경"),
        );
        cell.disabled = completed || piece.fixed;
        cell.classList.toggle("focus-hint", highlight === i);
        cell.onclick = () => rotate(i);
      } else if (goal || checkpoint) {
        const target = goal ?? checkpoint;
        const lit = (goal ? result.lit : result.visited).includes(x + "," + y);
        cell.classList.add(goal ? "goal" : "checkpoint");
        cell.classList.toggle("cyan", target.color === "C");
        cell.classList.toggle("lit", lit);
        cell.classList.toggle("wrong-color", !lit && result.wrongColor.includes(x + "," + y));
        cell.textContent = goal ? "◎" : "◇";
        const s = document.createElement("small");
        s.textContent = target.color ?? "통과";
        cell.append(s);
        cell.setAttribute(
          "aria-label",
          y +
            1 +
            "행 " +
            (x + 1) +
            (goal ? "열 목표 " : "열 경유지 ") +
            (target.color ?? "모든 색") +
            " " +
            (lit ? "켜짐" : "꺼짐"),
        );
        cell.setAttribute("role", "img");
      } else if (hazard) {
        cell.classList.add("hazard");
        cell.classList.toggle("triggered", result.triggered.includes(x + "," + y));
        cell.textContent = "×";
        cell.setAttribute("role", "img");
        cell.setAttribute("aria-label", coordinate(x, y) + " 금지 센서 " + (result.triggered.includes(x + "," + y) ? "작동" : "안전"));
      } else if (x === puzzle.source.x && y === puzzle.source.y) {
        cell.classList.add("source");
        cell.textContent = puzzle.source.dx === 1 ? "A→" : "←A";
        cell.setAttribute("role", "img");
        cell.setAttribute("aria-label", coordinate(x, y) + " 빛 A 출발 " + (puzzle.source.dx === 1 ? "오른쪽" : "왼쪽"));
      } else if (wall) {
        cell.classList.add("wall");
        cell.setAttribute("role", "img");
        cell.setAttribute("aria-label", coordinate(x, y) + " 벽");
      }
      if (cell.hasAttribute("aria-label")) cell.title = cell.getAttribute("aria-label");
      $("board").append(cell);
    }
  ctx.clearRect(0, 0, 640, 640);
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  for (const s of result.segments) {
    ctx.strokeStyle = s.color === "A" ? "#f47731" : "#159fad";
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo((s.x1 + 0.5) * 80, (s.y1 + 0.5) * 80);
    ctx.lineTo((s.x2 + 0.5) * 80, (s.y2 + 0.5) * 80);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  $("path-text").replaceChildren(...result.segments.map((s) => {
    const item = document.createElement("li");
    const direction = s.x2 > s.x1 ? "오른쪽" : s.x2 < s.x1 ? "왼쪽" : s.y2 > s.y1 ? "아래" : "위";
    item.textContent = `${s.color} 빛: ${coordinate(s.x2, s.y2)} 도착 (${direction})`;
    return item;
  }));
  if (!completed) $("status").textContent = highlight >= 0
    ? `${coordinate(pieces[highlight].x, pieces[highlight].y)}의 표시한 장치를 한 번 바꿔보세요. 힌트는 회당 120점입니다.`
    : result.triggered.length ? "금지 센서에 빛이 닿았습니다. 분기와 우회 경로를 다시 확인하세요."
    : result.loop ? "광선이 순환합니다. 경로를 확인하고 거울이나 분기를 바꿔보세요."
    : `목표 ${result.lit.length}/${puzzle.goals.length} · 경유지 ${result.visited.length}/${puzzle.checkpoints.length}` + (result.wrongColor.length ? " · 색이 맞지 않는 도착점이 있습니다." : " · 장치를 눌러 경로를 연결하세요.");
  $("undo").disabled = !history.length || completed;
  $("hint").disabled = completed;
  if (result.solved && !completed) {
    completed = true;
    const score = puzzleScore(true, moves, hints);
    best[recordKey()] = Math.max(
      Number(best[recordKey()]) || 0,
      score,
    );
    save();
    $("best").textContent = best[recordKey()] + " PT";
    $("result").replaceChildren();
    const h = document.createElement("h2"),
      p = document.createElement("p");
    h.textContent = (stage === TITLES.length ? "마스터 회로 완성! " : stage % 3 === 0 ? `${CAMPAIGN[puzzle.tier].name} 완성! ` : "빛의 길이 연결되었습니다. ") + score + " PT";
    p.textContent =
      "조작 " +
      moves +
      "회 · 힌트 " +
      hints +
      "회 · " +
      (score >= 850 ? "★★★" : score >= 650 ? "★★☆" : "★☆☆");
    $("result").append(h, p);
    $("result").hidden = false;
    $("next").hidden = stage === TITLES.length;
    $("next").textContent = stage % 3 === 0 && stage < TITLES.length ? `다음 장: ${CAMPAIGN[puzzle.tier + 1].name}` : "다음 퍼즐";
    $("status").textContent =
      stage === TITLES.length
        ? "마지막 퍼즐도 해결했습니다. 다른 코드로 다시 도전해보세요."
        : "목표·경유지·안전 조건을 모두 달성했습니다. 다음 실험을 시작할 수 있습니다.";
    $("board").classList.add("complete");
    const level = $("levels").querySelector(`[data-stage="${stage}"]`);
    level.classList.add("solved");
    level.setAttribute("aria-label", level.getAttribute("aria-label").replace(/, 완료$/, "") + ", 완료");
    const count = TITLES.filter((_, i) => best[recordKey(i + 1)]).length;
    $("campaign-progress").textContent = `이 코드에서 ${count} / ${TITLES.length} 완료`;
    $("campaign-meter").value = count;
    for (const b of $("board").querySelectorAll("button")) b.disabled = true;
    $("undo").disabled = true;
    $("hint").disabled = true;
    (stage < TITLES.length ? $("next") : $("result")).focus({ preventScroll: true });
  }
  $("board").classList.toggle("complete", completed);
  if (!completed && focusedPiece !== undefined) $("board").querySelector(`[data-piece="${focusedPiece}"]`)?.focus({ preventScroll: true });
  if (focusedStage !== undefined) $("levels").querySelector(`[data-stage="${focusedStage}"]`)?.focus({ preventScroll: true });
}
function rotate(i) {
  if (completed || !Number.isInteger(i) || i < 0 || i >= pieces.length || pieces[i].fixed) return;
  history.push(pieces.map((p) => ({ ...p })));
  if (history.length > 256) history.shift();
  pieces[i] = rotatePiece(pieces[i]);
  moves++;
  highlight = -1;
  render();
}
$("undo").onclick = () => {
  if (history.length && !completed) {
    pieces = history.pop();
    moves++;
    highlight = -1;
    render();
  }
};
$("board").onkeydown = (event) => {
  const index = Number(event.target.dataset.piece);
  if (!Number.isInteger(index) || !pieces[index]) return;
  const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  if (!direction) return;
  event.preventDefault();
  const current = pieces[index];
  const candidates = pieces.map((p, i) => ({ ...p, i })).filter((p) => !p.fixed && (direction[0] ? p.y === current.y && (p.x - current.x) * direction[0] > 0 : p.x === current.x && (p.y - current.y) * direction[1] > 0));
  candidates.sort((a, b) => Math.abs(a.x - current.x) + Math.abs(a.y - current.y) - Math.abs(b.x - current.x) - Math.abs(b.y - current.y));
  if (candidates[0]) $("board").querySelector(`[data-piece="${candidates[0].i}"]`)?.focus();
};
$("reset").onclick = start;
$("hint").onclick = () => {
  if (completed) return;
  highlight = nextHint(puzzle, pieces);
  if (highlight >= 0) {
    hints++;
    render();
  }
};
$("next").onclick = () => {
  if (completed && stage < TITLES.length) {
    stage++;
    start();
  }
};
$("apply-seed").onclick = () => {
  try {
    seed = cleanSeed($("seed").value);
    stage = 1;
    start();
  } catch (e) {
    announce(e.message);
  }
};
$("new-puzzle").onclick = () => {
  seed = freshSeed();
  stage = 1;
  start();
};
$("clear").onclick = () => {
  if (confirm("이 브라우저의 퍼즐 최고 기록을 삭제할까요?")) {
    best = {};
    save();
    start();
  }
};
tool(
  "configure_puzzle",
  "퍼즐 선택",
  {
    type: "object",
    properties: {
      stage: { type: "integer", minimum: 1, maximum: TITLES.length },
      seed: { type: "string", maxLength: 40 },
    },
    required: ["stage", "seed"],
    additionalProperties: false,
  },
  (input) => {
    if (
      !input ||
      !Number.isInteger(input.stage) ||
      input.stage < 1 ||
      input.stage > TITLES.length
    )
      throw Error("Invalid stage");
    const s = cleanSeed(input.seed);
    stage = input.stage;
    seed = s;
    start();
    return { stage, seed, targets: puzzle.goals.length, moves };
  },
);
start();
