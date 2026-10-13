# light-route — systematic edge-case audit / 2026-10-13

새 LOCAL 감사이며 이전 유지보수/CI/공개 이력과 분리한다. 기준 HEAD `192ac4b67a281f2f8f072a1d13f80191060121aa`, 최초 clean main 확인. Named echo-vault/neon-tactics/parcel-panic/light-route는 모두 변경 전에 inventory했다. 이 보고서는 light-route 범위다. 다른서비스/gallery/rankingserver NOT_INSPECTED/NOT_MODIFIED.

## 공유 요약 승인 계약 후속 검증

사용자의 2026-10-13 명시 결정으로 아래 정책 충돌을 RESOLVED 처리했다. 이번 후속 범위는 light-route progress/storage만이며, 이전 4개 앱 감사 작업 및 부모의 ranking-client 동기화와 분리한다. 시작 상태는 앞선 감사의 미커밋 7파일을 포함했고 이를 보존했다. 모델/세션/앱 입력 코드, other repos, ranking client/integration 파일은 이번에 수정하지 않았다.

### 계약과 변경

- 기존 15개 allowlist ID, own total18, 정수 0..total<=1000, canonical ISO UTC, 8192 UTF-8 bytes를 유지한다. 20개 앱/20단계로 확장하지 않는다.
- root의 version/apps 및 entry의 completed/total/updatedAt만 허용한다. unknown root/app/entry, 잘못된 root/apps/entry/type/count/date, malformed JSON, 저장된 빈 문자열/공백, oversize는 report와 clear 모두 false. 전체 raw 문자열/정상 peer/별도 private key를 그대로 두고 쓰기·삭제도 시도하지 않는다. missing key(null)와 정상 apps:{}는 허용한다.
- own-absent clear와 이미 동일한 report는 성공한 no-op이며 저장을 만들거나 다시 쓰지 않는다. 정상 갱신/자기 항목 삭제는 peer 값·필드 순서/compact JSON entry bytes를 유지한다. 정상 변경의 container 공백까지 보존하는 원문 편집기는 아니며 JSON 직렬화 공백은 바뀔 수 있다. 차단·own-absent clear는 공백을 포함한 전체 raw byte equality를 검사했다.
- 공유 변경은 exact readback, 자체 삭제는 두 own key의 null readback으로 확인한다. no-op 저장/삭제 또는 readback 거부를 성공으로 보고하지 않는다. 공유 실패에도 정상 private 완료/이어하기/자체 삭제가 동작하고 기존 실패 안내를 표시한다. readback 실패 후 이미 반영된 쓰기를 rollback하거나 다른 탭과 원자적으로 합치는 기능은 추가하지 않는다.
- 기존 session.test.js의 `gallery summary uses 15 allowlisted aggregate entries, genuine dates and own-only clear`에서 unknown `evil`을 삭제하고 true를 기대하던 assertion을 **사용자 승인으로 계약 변경**했다. 이제 report/clear false와 raw 동일을 기대한다. 정상 peer만 있는 별도 fixture에서는 기존 성공/자기 항목 삭제 검증을 유지한다. [D13](decisions.md#d13--공유-요약-원문-보존과-갱신-중단-계약-2026-10-13-사용자-명시-승인)에 맥락·대안·결정·이유·영향·검토를 기록했다.

### 실행 명령과 증거

| 명령 | 기존 production 실행 → 수정 후 | 증거 |
| --- | --- | --- |
| `node --test test/progress.test.js` | 3PASS/9FAIL → SAME command 12PASS, fail/skipped0 | `.qa/edge-20261013/progress-before.txt`, `summary/progress-after.txt` |
| `node --test --test-name-pattern 'gallery summary' test/session.test.js` | 0PASS/1FAIL → SAME command 1PASS | `.qa/edge-20261013/contract-before.txt`, `summary/contract-after.txt` |
| `npm test` | 최종41/41PASS, fail/skipped0; 이전29 + 신규12 | `.qa/edge-20261013/summary/tests-after.txt` |
| `npm run check` / `git diff --check` | PASS | `.qa/edge-20261013/summary/check-after.txt`; 최종 diff 검사 |
| `node tools/edge-browser.mjs http://127.0.0.1:59881/` | 기존 정상/한도실패/잘못된코드/IME/손상reload/quota flow PASS, 27checks, pageerror0 | `.qa/edge-20261013/browser-result.json`, `view-1440.png`, `view-390.png`, `view-320.png` |
| `node tools/summary-browser.mjs http://127.0.0.1:59881/` | 새9시나리오 PASS, 277checks, pageerror0 | `.qa/edge-20261013/summary/browser-result.json` 및 아래 캡처 |

BEFORE 명령은 production 수정 전에 실행했다. 당시 progress.js SHA256 `3611C59B6E1CA2DCAEAE54BE5DCE96A4E2B290B471343821A6B887E057F462A5`; storage.js는 이전 감사의 write readback 수정만 있는 상태였다. 실제 실패 assertion은 `root extra: report must reject (true !== false)`, `"": report must reject`, `data-mirage canonical entry bytes`, `own-absent clear preserves original bytes or absence`, `unconfirmed shared change must fail`, `readback (true !== false)`, `identical confirmed report needs no write`, `unconfirmed private deletion must fail`, private/shared 분리 test의 `true !== false`였다. 기존 계약 시험은 `approved contract rejects unknown app without sanitizing (true !== false)`로 실패했다. 아래 P3/P6/P7은 처음부터 통과한 새 coverage로 RED_GREEN이라고 부르지 않는다. 다른 P그룹의 모든 개별 fixture가 각각 baseline 실패했다고 주장하지 않는다.

### 추가 feature / boundary matrix

P번호는 test/progress.test.js의 실제 test name에 매핑한다. 명령은 위와 같고 모든 행 AFTER VERIFIED/PASS다. 기존 session/model/edge tests는 전체41개 실행에 포함된다.

| ID | 실제 test name | 경계 / baseline 결과 |
| --- | --- | --- |
| P1 | `progress: unknown root, app and entry fields block report and clear without sanitizing` | root extra/unknown evil/peer extra/own extra/prototype-name; good peer 포함 전체 raw 보존, set/remove 시도0 / FAIL |
| P2 | `progress: malformed, empty, primitive and wrong-root JSON preserve every byte` | empty/whitespace/malformed/null/bool/number/string/array/missing fields/wrong version/apps type / FAIL |
| P3 | `progress: invalid entries cannot erase a valid peer or repair a corrupt own entry` | malformed entry/type/missing/date/count; -1/fraction/string/null/nonfinite JSON null/1001/over-total; valid peer와 invalid own 모두 report/clear 중단 / PASS(new coverage) |
| P4 | `progress: documented 15 IDs, peer boundaries and canonical peer bytes survive own update and clear` | literal allowlist15 대조, peer0/0·0/1000·1000/1000, own1/18·18/18, 14 peers compact entry bytes/own-only clear / FAIL |
| P5 | `progress: absent and valid empty summaries initialize only on report; own-absent clear is a byte-preserving no-op` | missing key, apps:{}, whitespace 포함 valid peer; clear no write/no creation, 실제 report initializes / FAIL |
| P6 | `progress: exact 8KiB payload is accepted and one byte beyond blocks both operations` | 8192 수락,8193/UTF-8 oversize 보존 / PASS(new coverage) |
| P7 | `progress: invalid counters and clocks never write or consult an unavailable summary` | report0/negative/over/fraction/type/NaN/Infinity 및 invalid/throwing clock; read도0 / PASS(new coverage) |
| P8 | `progress: no-op summary write or own-entry deletion cannot claim success` | ignored setItem로 갱신/자기 항목 삭제 확인 실패; raw/peer/private 보존 / FAIL |
| P9 | `progress: denied reads, quota and denied readback report failure without touching siblings` | 초기 read 거부/write 예외/readback 거부; sibling 보존, 앞2종 raw 보존; 이미쓴후 readback 불가면 성공 주장 안함 / FAIL |
| P10 | `progress: repeated identical report and clear do not rewrite confirmed state` | repeat report(same timestamp)/clear no-op, unnecessary writes0 / FAIL |
| P11 | `storage clear: both own deletions require readback; no-op or partial removal cannot claim success` | private/legacy/둘다 no-op remove, 부분삭제, 이미부재, readback 거부; sibling 보존 / FAIL |
| P12 | `progress: blocked shared state does not prevent durable private completion, resume or own-only clear` | qa-0 limited18 실제 reducer 완료→private 저장/복원→summary reject→private clear; shared raw 유지 / FAIL |

### 실제 브라우저 확인

기존 Playwright1.61.1 설치와 실제 Chrome을 재사용한 새 `tools/summary-browser.mjs`는 .qa 아래 증거를 기록한다. 격리 임시 context, muted/headless, loopback만 허용. fixture는 shared storage 내용 또는 no-op Storage 메서드이며, 게임 승리/카운터/score를 주입하지 않았다. 각 시나리오에서 실제 코드 입력→limited18 선택→hint/reset(요약 쓰기0)→plan의 실제 장치 11click/835점 완료→새로고침/이어하기(요약 timestamp 동일)→삭제 취소→삭제 확인을 수행했다.

- 정상 요약: 14개 peer + 실제 own1/18, completion timestamp 범위, peer compact entry bytes, own-only 삭제 확인.
- 차단 6개: unknown root/app/entry, malformed `{`, 빈 문자열, primitive `null`. 각각 전체 raw 동일/요약 쓰기·삭제 시도0. private835점·독립1·재실행 가능한 기록·이어하기·자체 삭제는 성공하고 요약 실패를 알림.
- no-op 2개: shared setItem 무시 시 갱신/자기 항목 삭제 false와 알림; private removeItem 무시 시 실제 기록·완료 화면을 유지하고 실패 알림. 이때 valid shared own-entry 삭제는 기존 앱의 별도 clear 호출대로 처리되며 private clear와 원자적이라고 주장하지 않는다.
- 1440/390/320 입력/overflow 검사 PASS. 새 캡처 5개를 실제 열어 확인: `.qa/edge-20261013/summary/normal-1440.png`, `unknown-root-1440.png`, `unknown-app-390.png`, `empty-320.png`, `private-delete-noop-390.png`.
- UI/CSS/문구 자체 편집 없음. 다만 이전에 성공으로 보이던 잘못된 요약/무시된 삭제에서 기존 실패 안내가 나타나므로 **해당 failure-state 스크린샷 갱신 필요**; 위 unknown-root/app/empty 및 private-delete-noop 캡처가 재현 상태다. 정상 갤러리 대표 이미지 교체는 필요하지 않다.

### 소스 범위와 남은 한계

후속 inventory/read VERIFIED: architecture > README (api-spec/requirements/repo AGENTS 없음), decisions, package, gitattributes/ignore/workflow/check/serve, progress/storage, 관련 app lifecycle, session/edge tests, 기존 edge-browser harness 및 새 tests/harness. docs/verification 과거 이력은 PARTIAL(selected); 순수 model/session 구현은 이전 감사에서 검토했고 이번에는 unchanged hash/diff와 전체 시험으로 확인했다. repo 전체는 PARTIAL이며 unrelated/secret/.env/other repos는 NOT_INSPECTED/NOT_MODIFIED다.

이전 POLICY_CONFLICT/STOPPED는 해소했다. Node12개는 기존 `npm test` CI에 자동 포함되고, 기존+새 browser harness는 현 CI 미실행/manual이다. 이번 browser 검증은 LOCAL AFTER이며 별도 browser RED를 주장하지 않는다(Node RED 보존). 물리적 quota·브라우저 eviction·실제 OS IME·물리 터치·다른 엔진/보조기술·모든 seed/단계·cross-tab IO 원자성·remote CI/LIVE는 NOT_RUN. 외부 ranking/API/server는 N/A이며 CSP connect-src none 유지. 모델/규칙/버전/저장키/schema/retention 변경 없음. own preview59881만 종료하고 부모59540은 유지했다. No commit/push/deploy/delegation/model switch.

이번 추가 변경 10파일: dist/src/progress.js, dist/src/storage.js, test/session.test.js, new test/progress.test.js, new tools/summary-browser.mjs, architecture.md, README.md, docs/decisions.md, docs/verification.md, 이 문서. 앞선 미커밋 변경은 그대로 보존한다.

## 1차 감사 실행 결과

- `npm test`: 29/29 PASS, fail/skipped0. 기존23+신규6. 신규5개는 unchanged-baseline PASS coverage additions이며 RED_GREEN 아님.
- `node --test test/edge.test.js`: BEFORE 5PASS/1FAIL; AFTER 6/6PASS.
- `npm run check` 및 `git diff --check` PASS. 편집 텍스트만 UTF-8 without BOM/CRLF 정규화.
- `node tools/edge-browser.mjs http://127.0.0.1:51098/`: actual isolated Chrome/loopback primary+negative flows PASS. 동일 `--probe-ime` command BEFORE FAIL→AFTER PASS.
- 기존 .github/workflows/pages.yml의 npm test가 신규 Node tests를 실행한다. Browser harness는 현 CI 미실행/manual. REMOTE_CI/LIVE NOT_RUN.
- 재실행: `npm run dev -- 0`의 출력 URL을 harness에 전달. 기존 ../output/playwright/implement-20261012/node_modules/playwright/index.mjs(Playwright1.61.1) 사용; 다른설치는 PLAYWRIGHT_MODULE로 absolute module file 지정. Chrome C:/Program Files/Google/Chrome/Application/chrome.exe, headless/muted/ephemeral context. 개인browser profile에 접근하지 않음.
- 완료 후 owns-only preview process만 종료하며 부모59540 integration server 유지. No commit/push/deploy/delegation.

## 신규 실행 테스트

E번호는 문서참조다. 모두 test/edge.test.js; `node --test test/edge.test.js` 또는 `npm test`로 실행.

| ID | 실제 test name | baseline → after |
| --- | --- | --- |
| E1 | `edge: seed min/max trimming and type boundaries retain deterministic board` | PASS→PASS(new coverage) |
| E2 | `edge: rotation index type boundaries reject without mutating run` | PASS→PASS(new coverage) |
| E3 | `edge: exact undo retention can drain to empty without erasing hint costs` | PASS→PASS(new coverage) |
| E4 | `edge: corrupt last and achievement do not erase other valid records` | PASS→PASS(new coverage) |
| E5 | `edge: malformed replay type and terminal trailing action preserve source snapshot` | PASS→PASS(new coverage) |
| E6 | `edge: private write must confirm readback before claiming durability` | FAIL→PASS(readback fix) |

## Feature / boundary matrix

다음 표시한 Node tests(`npm test`) 및 B=tools/edge-browser.mjs의 실제 check 범위만 VERIFIED/PASS다. 기존 tests의 file prefix는 test/의 해당 *.test.js. 새 case가 없는 경계는 existing으로 명시한다.

| Feature / boundary | 실제 test / command mapping | cases / result |
| --- | --- | --- |
| Seed / stage / index inputs | E1/E2; model: rotation is reversible, fixed optics stay fixed, and scores/input limits hold | VERIFIED/PASS: 1/40/41code lengths/trim;empty/type/nonfinite; index-1/length/fraction/type/NaN/Infinity rejectrun unchanged; stage1/18/0/19 existing. |
| Undo / history / cap | E3; session: bounded input and undo retain replay correctness without erasing hint provenance | VERIFIED/PASS: 257decoyrotate→hint→256undo drains history/513moves/hint1/oldestrotation retained; emptyundo rejects;1024/1025 existing. |
| Corrupt records / replay | E4/E5; session: replay rejects forged counters/orientations, fixed moves, invalid actions and versions | VERIFIED/PASS: Corruptlast/badachievement quarantined whilegoodrecord retained/deduplicated; terminalsuffix bad actions rejectsource unchanged. |
| Limited terminal boundary | session: completion on the last allowed action succeeds; one extra action is rejected; 360 legal limited-move completions preserve v2 starts, and exhausting budgets fails | VERIFIED/PASS: Inclusive lastmovesuccess; unsolvedbudgetfailure/actionlock. ActualUI18 qa-0/11of13moves/835 then13decoyfailure. |
| Storage / retention / isolation | E6; session: history and records are bounded, oversize/corrupt storage fails safely, clear only own keys; byte retention cap evicts oldest replays before local storage exceeds 512KiB | VERIFIED/PASS: Unconfirmedreadback fails;12recent/120records/512KiBeviction; privatebadbytes notrewritten; own2keyclear/siblingkeep; browserquota permitsrotation. |
| Determinism / fairness / oracle | model: 1,800 deterministic campaign boards: independent reachability, valid cells, unsolved starts; all 18 fallback stages are reachable without any random search; session recordlane test | VERIFIED/PASS: Independent BFS compassreflection oracle1800boards/144fallback;practice/limited+independent/assisted distinct;undocost/hintprovenance; notminimumsolutionproof. |
| Reset / resume / cancel / focus | session: round-trip resume preserves exact orientation, hints, undo and mode across all stages; B keyboard rotation focus retained, restore exact moves, cancel delete preserves run | VERIFIED/PASS: Spacefocus/reload/continue1move; invalidcode statepreserved; widthSpace+undo costs2. |
| Keyboard / IME / focus | B: IME composition must preserve private run; IME composition must preserve focus; --probe-ime | NEW RED_GREEN: isComposing/legacy229에서 state/focus 보존. 합성 KeyboardEvent fixture; real OS IME 후보창 NOT_RUN. 일반키보드 입력은 actual primary flow. |
| Desktop / mobile | B: document fits 1440/390/320 + width별 pad/keyboard/undo/cancel checks | VERIFIED 1440×1000/390×900/320×900 actual UI input·3screenshots 열어서 visual QA. Physical touch/다른browser/screen reader NOT_RUN. |
| Storage failure / corrupted reload | B: corrupt import retains raw; corrupt load does not delete sibling; quota is visible; gameplay continues | NEW fixture: malformed localStorage/Storage.setItem QuotaExceededError. 물리적으로quota를채운시험아님; oversize는Node. |
| Repeat / rapid / late | 위terminal/undo/capture cases | VERIFIED 표시한 연속·거절·종료·restart. New auto-repeat/rapid double-click/pointercancel/two-tab exhaustive race NOT_RUN. |
| Async failures / races | N/A 외부transport없음 | 외부transport N/A. synchronous gameplay. |

## Failing test first / minimal fixes

1. Production 변경 전 `node --test test/edge.test.js` 실행. 실제 assertion: `unconfirmed private write must fail / true !== false`. setItem만으로durable성공을보고했다. storage.js에서 own private key 동일 raw readback만 추가. null/stale/throwingread는false, input/기록보존; NEONsharedprogress도미발행. SAME test PASS. Payload/rules/schema/retention unchanged. Readback은cross-tab transaction/disk durability 보증이 아니다.
2. 키보드 handler 변경 전 `node tools/edge-browser.mjs http://127.0.0.1:51098/ --probe-ime` 실행. 실제실패: `IME composition must preserve focus / '3' !== '4'`. app.js 첫줄isComposing/keyCode229 guard추가. SAME probe PASS; scoring/replay rules unchanged.

Ignored evidence: `.qa/edge-20261013/node-before.txt`, `ime-before.json`(실제실패), `ime-result.json`(같은probe PASS), `browser-result.json`(전체flow PASS). 테스트harness 초반 hidden-control timeout은 닫힌campaign/접힌details를열지않은 QA 준비오류; 실제 모달/summary click으로고쳤고 assertion을약화하지않았다. Production bug로집계안함.

## Actual browser flow / screenshots

qa-0/limited18 Spacefocus→reload/continue1move→삭제취소→합법plan의실제좌표click11회/835완료. decoy13회로한도실패잠금,잘못된코드거부. 캡처는 같은18reset→Space→undo2회/남은11·최고835.

Negativeflows: 삭제/목표취소 또는한도실패 + corruptreload + quota injection. NEON/PARCEL의503은endpoint interception이며 실제server장애증거아님. 게임state/score/victory injection없음. Witness/plan을 Node에서읽고 실제UI 입력을안내한다.
Reusable QA: 부모 output/playwright의 기존 parcel-qa.mjs/light-qa.mjs를읽고현재 선택자/조작으로 반복가능harness작성. Captures `.qa/edge-20261013/view-1440.png`, `view-390.png`, `view-320.png`.
Visible UI change: 정상 layout/CSS변경없음. 새preview refresh 불필요; failure-input QA증거는위capture와명령으로재현.

## Source inventory / review coverage

- Named light-route repo PARTIAL: 전체path inventory 후 task-related파일선택. Inventory를full-file review로주장하지않음.
- VERIFIED authoritative: architecture.md > README.md(requirements/api-spec없음); docs/decisions.md, package.json, .gitattributes, .gitignore, .github/workflows/pages.yml. Repo AGENTS없음; 사용자AGENTS준수.
- VERIFIED relevant source/tests/tools: model.js, core.js, session.js, storage.js, progress.js, app.js, index.html; test/model.test.js, session.test.js; tools/check.mjs, serve.mjs.
- PARTIAL auxiliary/history: 전체CSS/아트 전수독서 제외. browser/public-file gate는 화면/자산검증이며 전체접근성증명아님. docs/verification.md는latest 관련내용/통합지침 selected review;이전LIVE이력전수재검사안함.
- NOT_INSPECTED: .gitobjects/node_modules전수/credentials/.env(열지않음)/unrelatedrepos/gallery/rankingserver. Task/secret범위와unchanged auxiliary files라서선택제외.
- Root existing Playwright package.json 존재/version확인. 새runtime dependency없음. 아래 tracked baseline inventory;ignored QA/node_modules제외.

```text
dist/src/app.js
dist/src/storage.js
.gitattributes
.github/workflows/pages.yml
.gitignore
README.md
architecture.md
dist/favicon.svg
dist/index.html
dist/src/app.js
dist/src/core.js
dist/src/model.js
dist/src/progress.js
dist/src/session.js
dist/src/storage.js
dist/styles.css
docs/decisions.md
docs/provenance.md
docs/verification.md
package.json
test/model.test.js
test/session.test.js
tools/check.mjs
tools/serve.mjs
```

## Remaining untested / N/A / integration

POLICY_CONFLICT는 1차 감사 당시 affected part STOPPED였으며, 이후 사용자 명시 승인으로 위 후속 검증/D13에서 RESOLVED했다. 기존 unknown evil sanitize assertion은 승인된 계약 변경으로 수정했고 정상 동작 assertion은 유지했다. Publicranking/network/timer races N/A(synchronous/connect-src none); fileuploadimport N/A(localrestore only).

모든seed/캠페인을 개별browser완료한것아님. 모델witnesses는저작계약/표본의실행검증이다. RealOSIME/physicaldevices/allviewport+zoom+device/screenreaders/multi-tabwrite+clear/realbrowser eviction/allasyncinterleavings/WorkerCPU/humanfun+difficulty/remoteCI/LIVE/deploy NOT_RUN. Scoped-key isolation은same-origin browser security isolation증명이아님.
Changed files: dist/src/app.js, dist/src/storage.js, new test/edge.test.js, new tools/edge-browser.mjs, new docs/edge-cases-20261013.md, docs/verification.md(newtop), docs/decisions.md(D12). 기존 legitimate tests/user records/rules/versions/maps/retention/storage schema 보존. Parent integrates/releases.
