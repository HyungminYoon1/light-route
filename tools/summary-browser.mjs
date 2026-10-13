// Companion to edge-browser.mjs: storage fixtures only; all gameplay uses actual UI input.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createRun, challengePlan, restoreRun, runStatus, independentCount } from "../dist/src/session.js";
import { APP_IDS, PROGRESS_KEY } from "../dist/src/progress.js";
import { SESSION_KEY } from "../dist/src/storage.js";

const url = process.argv[2];
assert.equal(new URL(url).hostname, "127.0.0.1", "loopback only");
const modulePath = process.env.PLAYWRIGHT_MODULE ?? resolve("../output/playwright/implement-20261012/node_modules/playwright/index.mjs");
const { chromium } = await import(pathToFileURL(modulePath).href);
const output = resolve(".qa/edge-20261013/summary");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--mute-audio"] });
const instant = "2026-10-13T03:00:00.000Z";
const peers = Object.fromEntries(APP_IDS.filter(id => id !== "light-route").map(id =>
  [id, { updatedAt: instant, total: 18, completed: 2 }]));
const encoded = apps => JSON.stringify({ version: 1, apps });
const validRaw = encoded(peers), ownRaw = encoded({ ...peers, "light-route": { completed: 1, total: 18, updatedAt: instant } });
const plan = challengePlan(createRun(18, "qa-0", "limited").puzzle);
const checks = [], faults = [], scenarios = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const fixtures = [
  { name: "normal", raw: validRaw, width: 1440 },
  { name: "unknown-root", raw: JSON.stringify({ version: 1, apps: peers, extra: "fixture" }), blocked: true, width: 1440 },
  { name: "unknown-app", raw: " \r\n" + encoded({ ...peers, evil: { fixture: "한글" } }) + "\t", blocked: true, width: 390 },
  { name: "unknown-entry", raw: encoded({ ...peers, "think-forge": { ...peers["think-forge"], extra: "fixture" } }), blocked: true, width: 390 },
  { name: "malformed", raw: "{", blocked: true, width: 320 },
  { name: "empty", raw: "", blocked: true, width: 320 },
  { name: "primitive", raw: "null", blocked: true, width: 320 },
  { name: "ignored-summary-write-delete", raw: ownRaw, fault: "summary-noop", width: 390 },
  { name: "ignored-private-delete", raw: validRaw, fault: "private-delete-noop", width: 390 },
];
let result;
try {
  for (const fixture of fixtures) {
    const context = await browser.newContext({ viewport: { width: fixture.width, height: fixture.width === 1440 ? 1000 : 900 }, reducedMotion: "reduce" });
    const page = await context.newPage();
    page.on("pageerror", error => faults.push(fixture.name + ": " + error.message));
    await page.addInitScript(({ fixture, progressKey, sessionKey }) => {
      // Each context has its own ephemeral storage. On reload, keep the actual run.
      if (!sessionStorage.getItem("summary-fixture-ready")) {
        localStorage.setItem(progressKey, fixture.raw);
        localStorage.setItem("other-app-private", "keep exact bytes\r\n한글");
        localStorage.setItem("light-route-v1", "{}");
        sessionStorage.setItem("summary-fixture-ready", "1");
      }
      const set = Storage.prototype.setItem, remove = Storage.prototype.removeItem;
      window.summaryFixtureIO = [];
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && key === progressKey) {
          window.summaryFixtureIO.push(["set", key]);
          if (fixture.fault === "summary-noop") return;
        }
        return set.call(this, key, value);
      };
      Storage.prototype.removeItem = function(key) {
        if (this === localStorage && key === progressKey) window.summaryFixtureIO.push(["remove", key]);
        if (this === localStorage && fixture.fault === "private-delete-noop" && [sessionKey, "light-route-v1"].includes(key)) return;
        return remove.call(this, key);
      };
    }, { fixture, progressKey: PROGRESS_KEY, sessionKey: SESSION_KEY });
    const raw = key => page.evaluate(key => localStorage.getItem(key), key);
    const label = name => fixture.name + ": " + name;
    await page.goto(url);
    check(label("initial view preserves shared bytes"), await raw(PROGRESS_KEY), fixture.raw);
    check(label("initial view never creates private run"), await raw(SESSION_KEY), null);
    await page.locator("#seed").fill("qa-0");
    await page.locator("#apply-seed").click();
    await page.locator("#mode").selectOption("limited");
    await page.locator('[data-stage="18"]').click();
    await page.locator("#hint").click();
    await page.locator("#reset").click();
    check(label("visit hint reset never publish progress"), await raw(PROGRESS_KEY), fixture.raw);
    check(label("no summary writes before completion"), await page.evaluate(() => window.summaryFixtureIO), []);
    const beforeCompletion = Date.now();
    for (const index of plan.rotations) await page.locator('[data-piece="' + index + '"]').click();
    check(label("actual limited completion score"), (await page.locator("#result").textContent()).includes("835점"), true);
    const savedRaw = await raw(SESSION_KEY), saved = JSON.parse(savedRaw);
    check(label("private completion is replay-valid"), runStatus(restoreRun(saved.last)), "complete");
    check(label("private independent achievement remains"), independentCount(saved), 1);
    check(label("best remains visible"), await page.locator("#best").textContent(), "835점");
    const blocksSummary = fixture.blocked || fixture.fault === "summary-noop";
    if (blocksSummary) {
      check(label("failed summary notice"), await page.locator("#notice").textContent(), "퍼즐 기록은 저장했습니다. 갤러리 요약은 갱신하지 못했습니다.");
      check(label("blocked summary exact raw preservation"), await raw(PROGRESS_KEY), fixture.raw);
      if (fixture.blocked) check(label("blocked summary attempts no write or delete"), await page.evaluate(() => window.summaryFixtureIO), []);
    } else {
      const summaryRaw = await raw(PROGRESS_KEY), apps = JSON.parse(summaryRaw).apps;
      check(label("actual unique stage count"), [apps["light-route"].completed, apps["light-route"].total], [1, 18]);
      check(label("actual completion time"), Date.parse(apps["light-route"].updatedAt) >= beforeCompletion && Date.parse(apps["light-route"].updatedAt) <= Date.now(), true);
      for (const [id, entry] of Object.entries(peers)) {
        check(label(id + " values preserved"), apps[id], entry);
        check(label(id + " canonical entry bytes preserved"), summaryRaw.includes(JSON.stringify(id) + ":" + JSON.stringify(entry)), true);
      }
      check(label("single summary write on actual completion"), await page.evaluate(() => window.summaryFixtureIO.length), 1);
    }
    check(label("layout fits " + fixture.width), await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    if (["normal", "unknown-root", "unknown-app", "empty"].includes(fixture.name)) {
      await page.screenshot({ path: resolve(output, fixture.name + "-" + fixture.width + ".png"), fullPage: true });
    }
    const sharedAfter = await raw(PROGRESS_KEY);
    await page.reload();
    await page.locator("#continue").click();
    check(label("resume preserves private bytes"), await raw(SESSION_KEY), savedRaw);
    check(label("resume preserves shared bytes and timestamp"), await raw(PROGRESS_KEY), sharedAfter);
    check(label("resume never publishes summary"), await page.evaluate(() => window.summaryFixtureIO), []);
    check(label("restored completed result visible"), await page.locator("#result").isVisible(), true);
    for (const details of await page.locator("#clear").locator("xpath=ancestor::details").all()) {
      if (!await details.evaluate(element => element.open)) await details.locator(":scope > summary").click();
    }
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator("#clear").click();
    check(label("cancel clear preserves private"), await raw(SESSION_KEY), savedRaw);
    check(label("cancel clear preserves shared"), await raw(PROGRESS_KEY), sharedAfter);
    page.once("dialog", dialog => dialog.accept());
    await page.locator("#clear").click();
    if (fixture.fault === "private-delete-noop") {
      check(label("failed private clear keeps actual run"), await raw(SESSION_KEY), savedRaw);
      check(label("failed private clear keeps legacy"), await raw("light-route-v1"), "{}");
      check(label("failed private clear keeps displayed completion"), await page.locator("#result").isVisible(), true);
      check(label("failed private clear is visible"), await page.locator("#notice").textContent(), "일부 기록을 삭제하지 못했습니다. 브라우저 저장 설정을 확인하세요.");
      await page.screenshot({ path: resolve(output, "private-delete-noop-390.png"), fullPage: true });
    } else {
      check(label("private clear removes session without re-creation"), await raw(SESSION_KEY), null);
      check(label("private clear removes legacy"), await raw("light-route-v1"), null);
      check(label("private clear starts blank state"), await page.locator("#moves").textContent(), "00");
      if (blocksSummary) {
        check(label("clear preserves blocked shared bytes"), await raw(PROGRESS_KEY), fixture.raw);
        check(label("clear summary failure is visible"), await page.locator("#notice").textContent(), "퍼즐 기록은 삭제했습니다. 갤러리 요약을 삭제하지 못했습니다.");
        if (fixture.blocked) check(label("clear never mutates invalid shared state"), await page.evaluate(() => window.summaryFixtureIO), []);
      } else {
        check(label("own-only clear preserves all canonical peer bytes"), await raw(PROGRESS_KEY), validRaw);
        check(label("successful clear is visible"), await page.locator("#notice").textContent(), "기록을 삭제했습니다.");
      }
    }
    check(label("unrelated private key unchanged"), await raw("other-app-private"), "keep exact bytes\r\n한글");
    scenarios.push({ name: fixture.name, status: "PASS", width: fixture.width, fixture: "shared storage content / optional no-op method" });
    await context.close();
  }
  check("all scenarios pageerrors", faults, []);
  result = { status: "PASS", scenarios, checks, faults, limitations: ["Chrome only", "synthetic storage faults", "canonical peer entry bytes; successful writes re-encode JSON whitespace", "no cross-tab transaction or remote CI/live test"] };
  console.log(JSON.stringify({ status: result.status, scenarios, checks: checks.length, faults }));
} catch (error) {
  result = { status: "FAIL", scenarios, checks, failure: error.message, faults };
  console.error(JSON.stringify(result)); process.exitCode = 1;
} finally {
  await writeFile(resolve(output, "browser-result.json"), JSON.stringify(result, null, 2));
  await browser.close();
}
