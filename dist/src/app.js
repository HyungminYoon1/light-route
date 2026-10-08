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
  makePuzzle,
  rotatePiece,
  trace,
  puzzleScore,
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
function save() {
  if (Object.keys(best).length > 120) delete best[Object.keys(best)[0]];
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
    "EXPERIMENT " + String(stage).padStart(2, "0") + " / 12";
  $("stage-title").textContent = puzzle.title;
  $("result").hidden = true;
  $("next").hidden = true;
  $("status").textContent =
    stage < 6
      ? "거울을 눌러 빛의 방향을 바꾸세요."
      : stage < 9
        ? "분기 장치도 회전할 수 있습니다. 두 목표를 켜보세요."
        : "주황 A와 청록 C, 목표가 요구하는 빛을 연결하세요.";
  announce("");
  render();
}
function render() {
  const result = trace(puzzle, pieces);
  $("moves").textContent = String(moves).padStart(2, "0");
  $("targets").textContent =
    "목표 " + result.lit.length + " / " + puzzle.goals.length;
  $("best").textContent = best[seed + "-" + stage]
    ? best[seed + "-" + stage] + " PT"
    : "—";
  $("levels").replaceChildren(
    ...TITLES.map((t, i) => {
      const b = document.createElement("button");
      b.className =
        "level" +
        (stage === i + 1 ? " current" : "") +
        (best[seed + "-" + (i + 1)] ? " solved" : "");
      b.textContent = String(i + 1).padStart(2, "0");
      b.setAttribute("aria-label", i + 1 + "단계 " + t);
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
        wall = puzzle.walls.some((w) => w.x === x && w.y === y),
        cell = document.createElement(piece ? "button" : "div");
      cell.className = "cell";
      if (piece) {
        cell.classList.add(piece.type);
        cell.textContent =
          piece.type === "filter"
            ? piece.color
            : piece.type === "splitter"
              ? piece.turn
                ? "╲│"
                : "╱│"
              : piece.turn
                ? "\\"
                : "/";
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
                ? "광선 분기 " + (piece.turn ? "역슬래시" : "슬래시")
                : "거울 " + (piece.turn ? "역슬래시" : "슬래시")),
        );
        cell.disabled = completed;
        cell.classList.toggle("focus-hint", highlight === i);
        cell.onclick = () => rotate(i);
      } else if (goal) {
        cell.classList.add("goal");
        cell.classList.toggle("cyan", goal.color === "C");
        cell.classList.toggle("lit", result.lit.includes(x + "," + y));
        cell.textContent = "◎";
        const s = document.createElement("small");
        s.textContent = goal.color;
        cell.append(s);
        cell.setAttribute(
          "aria-label",
          y +
            1 +
            "행 " +
            (x + 1) +
            "열 목표 " +
            goal.color +
            " " +
            (result.lit.includes(x + "," + y) ? "켜짐" : "꺼짐"),
        );
      } else if (x === 0 && y === puzzle.source.y) {
        cell.classList.add("source");
        cell.textContent = "빛 A";
      } else if (wall) cell.classList.add("wall");
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
  $("undo").disabled = !history.length || completed;
  $("hint").disabled = completed;
  if (result.solved && !completed) {
    completed = true;
    const score = puzzleScore(true, moves, hints);
    best[seed + "-" + stage] = Math.max(
      Number(best[seed + "-" + stage]) || 0,
      score,
    );
    save();
    $("best").textContent = best[seed + "-" + stage] + " PT";
    $("result").replaceChildren();
    const h = document.createElement("h2"),
      p = document.createElement("p");
    h.textContent = "빛의 길이 연결되었습니다. " + score + " PT";
    p.textContent =
      "조작 " +
      moves +
      "회 · 힌트 " +
      hints +
      "회 · " +
      (score >= 850 ? "★★★" : score >= 650 ? "★★☆" : "★☆☆");
    $("result").append(h, p);
    $("result").hidden = false;
    $("next").hidden = stage === 12;
    $("status").textContent =
      stage === 12
        ? "마지막 퍼즐도 해결했습니다. 다른 코드로 다시 도전해보세요."
        : "모든 목표가 켜졌습니다. 다음 실험을 시작할 수 있습니다.";
    for (const b of $("board").querySelectorAll("button")) b.disabled = true;
    $("undo").disabled = true;
    $("hint").disabled = true;
  }
}
function rotate(i) {
  if (completed || !Number.isInteger(i) || i < 0 || i >= pieces.length) return;
  history.push(pieces.map((p) => ({ ...p })));
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
$("reset").onclick = start;
$("hint").onclick = () => {
  if (completed) return;
  highlight = pieces.findIndex((p, i) =>
    p.type === "filter"
      ? p.color !== puzzle.solution[i].color
      : p.turn !== puzzle.solution[i].turn,
  );
  if (highlight >= 0) {
    hints++;
    $("status").textContent =
      "테두리로 표시한 장치를 한 번 바꿔보세요. 힌트 사용은 점수에 반영됩니다.";
    render();
  }
};
$("next").onclick = () => {
  if (completed && stage < 12) {
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
      stage: { type: "integer", minimum: 1, maximum: 12 },
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
      input.stage > 12
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
