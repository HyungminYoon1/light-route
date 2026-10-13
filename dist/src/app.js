import {
  $,
  freshSeed,
  cleanSeed,
  loadLocal,
  announce,
  tool,
} from "./core.js";
import {
  N,
  TITLES,
  CAMPAIGN,
  VERSION,
  trace,
  puzzleScore,
} from "./model.js";
import { createRun, applyAction, restoreRun, runStatus, rememberRun, emptyStore,
  stageRecords, recordScore, independentCount, MAX_ACTIONS } from "./session.js";
import { readStore, writeStore, clearStore } from "./storage.js";
import { reportProgress, clearProgress } from "./progress.js";
const previous = loadLocal("light-route-v1", {});
const legacy = previous && typeof previous === "object" && !Array.isArray(previous) ? previous : {};
let store = readStore(), run, awaitingResume = Boolean(store.last);
let seed = store.last?.seed ?? freshSeed(),
  stage = store.last?.stage ?? 1,
  mode = store.last?.mode ?? "practice",
  puzzle,
  pieces,
  moves = 0,
  hints = 0,
  completed = false,
  highlight = -1;
const ctx = $("rays").getContext("2d");
const records = (level = stage) => stageRecords(store, seed, level, mode);
const modeName = () => mode === "limited" ? "제한 이동" : "연습";
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
function persist() {
  const oldCount = independentCount(store);
  const next = rememberRun(store, run);
  if (!writeStore(next)) {
    announce("저장할 수 없습니다. 이 화면에서 계속 진행할 수 있습니다.");
    return;
  }
  store = next;
  const count = independentCount(store);
  if (runStatus(run) === "complete" && (run.hints === 0 || count !== oldCount)) {
    const ok = count ? reportProgress(count, TITLES.length) : clearProgress();
    if (!ok) announce("퍼즐 기록은 저장했습니다. 갤러리 요약은 갱신하지 못했습니다.");
  }
}
function start({ initial = false } = {}) {
  run = createRun(stage, seed, mode);
  if (!initial) {
    awaitingResume = false;
    announce("");
    persist();
  }
  render();
}
function render() {
  ({ puzzle, pieces, moves, hints, highlight } = run);
  completed = runStatus(run) === "complete";
  const stopped = runStatus(run) !== "playing" || awaitingResume;
  const focusedPiece = document.activeElement?.dataset.piece;
  const focusedStage = document.activeElement?.dataset.stage;
  const result = trace(puzzle, pieces);
  $("seed").value = seed;
  $("mode").value = mode;
  $("stage-number").textContent = `${stage} / ${TITLES.length}단계 · ${modeName()}`;
  $("stage-title").textContent = puzzle.title;
  $("chapter-title").textContent = `${puzzle.tier + 1}장 · ${CAMPAIGN[puzzle.tier].name}`;
  $("mission").textContent = CAMPAIGN[puzzle.tier].rule;
  $("mission-detail").textContent = `목표 ${puzzle.goals.length}개 · 경유지 ${puzzle.checkpoints.length}개` + (puzzle.hazards.length ? ` · 금지 센서 ${puzzle.hazards.length}개는 꺼 두기` : "") + (pieces.some((p) => p.fixed) ? " · 고정 거울 포함" : "");
  $("resume-panel").hidden = !awaitingResume;
  if (awaitingResume) $("resume-label").textContent = `${store.last.seed} · ${store.last.stage}단계 · ${modeName()} · 조작 ${store.last.moves}회 · 힌트 ${store.last.hints}회`;
  $("recent").replaceChildren(new Option("최근 코드 선택", ""), ...store.recent.map((e) => new Option(`${e.seed} · ${e.stage}단계`, e.seed)));
  $("recent").disabled = !store.recent.length;
  $("budget").textContent = mode === "limited" ? `남은 조작 ${Math.max(0, run.budget - moves)} / ${run.budget}` : "";
  $("budget").hidden = mode !== "limited";
  $("moves").textContent = String(moves).padStart(2, "0");
  $("targets").textContent =
    "목표 " + result.lit.length + " / " + puzzle.goals.length;
  $("constraints").textContent = `경유지 ${result.visited.length} / ${puzzle.checkpoints.length}` + (puzzle.hazards.length ? ` · 금지 센서 ${result.triggered.length}개 작동` : "");
  $("constraints").classList.toggle("warning", result.triggered.length > 0);
  const ownRecords = records();
  const bestOf = (assisted) => Math.max(0, ...ownRecords.filter((r) => Boolean(r.hints) === assisted).map(recordScore));
  $("best").textContent = bestOf(false) ? bestOf(false) + "점" : "—";
  $("assisted-best").textContent = bestOf(true) ? bestOf(true) + "점" : "—";
  const oldScore = legacy && typeof legacy === "object" ? legacy[VERSION + "|" + seed + "-" + stage] : null;
  $("legacy-best").textContent = Number.isInteger(oldScore) && oldScore >= 20 && oldScore <= 1000 ? `이전 최고 ${oldScore}점 · 힌트 여부 미기록` : "";
  const legacyCleared = TITLES.filter((_, i) => {
    const score = legacy[VERSION + "|" + seed + "-" + (i + 1)];
    return Number.isInteger(score) && score >= 20 && score <= 1000;
  }).length;
  $("legacy-progress").textContent = legacyCleared ? `이 코드의 이전 완료 ${legacyCleared}/${TITLES.length} · 힌트 여부 미기록` : "";
  const cleared = TITLES.filter((_, i) => records(i + 1).some((r) => !r.hints)).length;
  const assistedCleared = TITLES.filter((_, i) => records(i + 1).some((r) => r.hints)).length;
  $("campaign-progress").textContent = `${modeName()} · 스스로 완료 ${cleared}/${TITLES.length} · 힌트 완료 ${assistedCleared}`;
  $("campaign-meter").value = cleared;
  $("levels").replaceChildren(
    ...TITLES.map((t, i) => {
      const b = document.createElement("button");
      b.className =
        "level" +
        (stage === i + 1 ? " current" : "") +
        (records(i + 1).some((r) => !r.hints) ? " solved" : "") +
        (records(i + 1).some((r) => r.hints) ? " assisted" : "");
      b.dataset.stage = i + 1;
      b.textContent = String(i + 1).padStart(2, "0");
      b.setAttribute("aria-label", `${i + 1}단계 ${t}, ${CAMPAIGN[Math.floor(i / 3)].name}` + (records(i + 1).some((r) => !r.hints) ? ", 스스로 완료" : records(i + 1).length ? ", 힌트 완료" : ""));
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
        cell.disabled = stopped || piece.fixed;
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
  $("status").textContent = awaitingResume ? "이어하기 또는 새 세트를 선택하세요."
    : runStatus(run) === "failed" ? "조작 한도에 도달했습니다. 처음 배치로 다시 시작하세요."
    : runStatus(run) === "full" ? `${MAX_ACTIONS}회 입력을 기록했습니다. 처음 배치로 다시 시작하세요.`
    : completed ? "완료"
    : highlight >= 0 ? `${coordinate(pieces[highlight].x, pieces[highlight].y)} 장치를 한 번 변경하세요.`
    : result.triggered.length ? "금지 센서에 빛이 닿았습니다."
    : result.loop ? "광선이 순환합니다."
    : result.wrongColor.length ? "목표 또는 경유지의 색을 확인하세요." : "장치를 눌러 경로를 연결하세요.";
  $("undo").disabled = !run.history.length || stopped;
  $("hint").disabled = stopped;
  $("result").hidden = !completed;
  $("next").hidden = !completed || stage === TITLES.length;
  if (completed) {
    const score = puzzleScore(true, moves, hints);
    $("result").replaceChildren();
    const h = document.createElement("h2"),
      p = document.createElement("p");
    h.textContent = `완료 · ${score}점`;
    p.textContent =
      "조작 " +
      moves +
      "회 · 힌트 " +
      hints +
      `회 · ${modeName()} · ${hints ? "힌트 사용" : "스스로 완료"}`;
    $("result").append(h, p);
    $("result").hidden = false;
    $("next").hidden = stage === TITLES.length;
    $("next").textContent = stage % 3 === 0 && stage < TITLES.length ? `다음 장: ${CAMPAIGN[puzzle.tier + 1].name}` : "다음 퍼즐";
  }
  $("board").classList.toggle("complete", completed);
  if (!completed && focusedPiece !== undefined) $("board").querySelector(`[data-piece="${focusedPiece}"]`)?.focus({ preventScroll: true });
  if (focusedStage !== undefined) $("levels").querySelector(`[data-stage="${focusedStage}"]`)?.focus({ preventScroll: true });
}
function act(action) {
  if (awaitingResume) return;
  try { run = applyAction(run, action); } catch { return; }
  persist();
  render();
  if (completed) (stage < TITLES.length ? $("next") : $("result")).focus({ preventScroll: true });
}
function rotate(i) { act({ type: "rotate", index: i }); }
$("undo").onclick = () => act({ type: "undo" });
$("board").onkeydown = (event) => {
  if (event.isComposing || event.keyCode === 229) return;
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
$("reset").onclick = () => start();
for (const button of document.querySelectorAll("[data-practice-stage]")) button.onclick = () => {
  stage = Number(button.dataset.practiceStage);
  start();
};
$("hint").onclick = () => act({ type: "hint" });
$("continue").onclick = () => {
  if (!store.last) return;
  run = restoreRun(store.last);
  ({ seed, stage, mode } = run);
  awaitingResume = false;
  render();
};
$("mode").onchange = () => {
  mode = $("mode").value;
  start();
};
$("recent").onchange = () => {
  const entry = store.recent.find((e) => e.seed === $("recent").value);
  if (!entry) return;
  ({ seed, stage, mode } = entry);
  start();
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
  if (confirm("이 브라우저의 LIGHT ROUTE 코드·진행·최고 기록을 모두 삭제할까요?")) {
    const ownCleared = clearStore(), summaryCleared = clearProgress();
    if (!ownCleared) {
      announce("일부 기록을 삭제하지 못했습니다. 브라우저 저장 설정을 확인하세요.");
      return;
    }
    store = emptyStore();
    for (const k of Object.keys(legacy ?? {})) delete legacy[k];
    seed = freshSeed(); stage = 1; mode = "practice"; awaitingResume = false;
    start({ initial: true });
    announce(summaryCleared ? "기록을 삭제했습니다." : "퍼즐 기록은 삭제했습니다. 갤러리 요약을 삭제하지 못했습니다.");
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
start({ initial: true });
