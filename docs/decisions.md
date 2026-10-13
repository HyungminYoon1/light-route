# 결정 기록

## D13 — 공유 요약 원문 보존과 갱신 중단 계약 (2026-10-13, 사용자 명시 승인)

- 맥락: D12 감사에서 architecture/D10의 잘못된 공유 상태 보존과 기존 progress.js/session.test.js의 unknown `evil` 제거 기대가 충돌하여 해당 부분을 중단했다. 사용자가 이번 후속 작업에서 “unknown fields / malformed state는 원본 보존·갤러리 요약 갱신 중단”을 명시 승인했다.
- 대안: 기존 sanitize 유지; 공유 상태를 새 형식으로 이전/복구; 기존 형식 그대로 전체 검증 후 정상 상태에서만 자기 항목 변경.
- 결정: 세 번째를 적용한다. root는 version/apps 두 필드, apps는 기존 허용 15개 ID만, 각 entry는 completed/total/updatedAt 세 필드만 허용한다. 기존 정수 0..total<=1000/정규 ISO UTC/8KiB 경계, own total18, 버전·키·보존 상한은 유지한다. root/entry/type/date/count/JSON/크기 오류나 unknown 필드가 하나라도 있으면 report/clear 모두 false, 쓰기·삭제 시도 없이 전체 raw 문자열을 바이트 그대로 보존한다. 저장된 빈 문자열/공백은 오류이며, getItem===null만 부재다. 정상 apps:{}는 허용한다.
- 무변경/IO 결정: own entry가 없을 때 clear는 원문/부재를 유지하고 true; 직렬화 결과가 이미 같은 report도 쓰지 않는다. 정상 변경은 peer 값과 필드 순서를 유지하며 container 공백은 JSON 직렬화로 바뀔 수 있다. 공유 setItem의 동일 문자열 readback 및 자체 두 키 삭제의 null readback을 확인한다. 무시된 setItem/removeItem 또는 확인 불가를 성공으로 보고하지 않는다.
- 이유: 타 앱 데이터의 자동 정리·수선 권한을 추정하지 않고, 승인된 공유 계약과 사용자의 기기 내 기록을 보존한다. 공유 실패는 자체 저장 성공을 되돌리지 않는다. 기존 앱의 별도 실패 안내와 플레이/이어하기/자체 삭제 경계를 재사용한다.
- 테스트 계약 변경: `gallery summary uses 15 allowlisted aggregate entries, genuine dates and own-only clear`의 과거 unknown `evil` 제거 성공 assertion은 이 승인으로 명시적으로 폐기했다. 새 expectation은 report/clear false와 원문 동일이며, 별도의 정상 peer fixture에서 기존 정상 갱신·자기 삭제 assertion을 유지했다. 통과를 위한 assertion 완화가 아니다. 기존 production에서 변경한 assertion FAIL을 실행·보존한 뒤 수정했다.
- 영향 파일: dist/src/progress.js, dist/src/storage.js, test/session.test.js, new test/progress.test.js, new tools/summary-browser.mjs, architecture.md, README.md, docs/edge-cases-20261013.md, docs/verification.md.
- 검증/검토: 신규 12개 BEFORE 3PASS/9FAIL → SAME command 12PASS; 승인 변경 기존 시험 1FAIL→1PASS; 전체41PASS, check PASS. 격리 Chrome에서 정상/차단/무시된 IO 9개 흐름 PASS. 상세 명령·원문 로그·캡처는 edge audit. Node tests는 기존 CI 대상, browser harness는 수동이다. 다중 탭 트랜잭션/실제 디스크 영속성은 보장하지 않으며 readback 실패 시 이미 반영된 쓰기를 임의 rollback하지 않는다. 두 private 키의 부분 삭제도 원자적이지 않으며 확인 실패로 보고한다. 모델/세션/점수/생성/랭킹 클라이언트/타 저장소는 이번 후속 작업에서 변경하지 않았다.

## D12 — systematic input and durable-save audit (2026-10-13)

- Context: 실제회귀에서 no-op/stale/deniedread도 저장성공보고, IME조합이단축키/초점변경.
- Options: setItem만신뢰 / 형식변경 / own-key동일문자열readback;조합키실행 / 모든키비활성화 / isComposing와229만무시.
- Decision: storage.js의기존ownkey쓰기뒤readback확인, 실패는기존memory-only경로. app.js는조합중게임단축키/초점변경하지않음. 새저장key/field/cap/retention/network/score/version변경없음.
- Rationale: documented durable-save전제/입력의도를지키는conservative localfix. 실제FAIL후최소수정및같은testPASS. Legitimateassertions/합법replays유지.
- Affected files: dist/src/app.js, dist/src/storage.js, test/edge.test.js, tools/edge-browser.mjs, docs/edge-cases-20261013.md, docs/verification.md.
- Review: readback은cross-tab transaction/diskdurability보증아님. RealOSIME/multi-tab NOT_RUN;syntheticfixture/actualUI분리. Nodecases기존CI에포함/browserharness수동. 당시 shared-summary reject/preserve 대sanitize정책충돌은 affected part STOPPED/부모인계였다. 이후 사용자 명시 승인으로 D13에서 해결했다.

## D11 — 저장 필드 계약과 경로 분석 과제 (2026-10-13)

- 맥락: restoreRun은 임의 score/status 같은 필드를 묵인했다. 계산 점수에는 쓰지 않았지만 문서의 결과 주입 거절 계약과 맞지 않았다.
- 대안: 임의 필드를 계속 버림; 새 저장 버전; 기존 canonical snapshot 필드만 명시적으로 수락.
- 결정: 9개 기존 저장 필드의 정확한 개수와 이름을 검사한다. 정상 저장은 그대로 복원된다. 현재 코드·방식을 유지하는 9/12/18단계 과제 버튼과 직진/반사·색 덮어쓰기·경유지·센서 분석 안내를 추가한다.
- 이유: 불명확한 결과 필드를 저장 증거로 받아들이지 않으며, 동일 배치를 연습하고 제한 이동에서 다시 풀 수 있게 한다.
- 영향 파일: dist/src/session.js, app.js, dist/index.html, styles.css, test/session.test.js, docs/provenance.md.
- 후속 검토: light-v2/light-run-v1 생성·점수·이동 예산·저장 상한·기존 canonical 기록 유지. 임의 필드가 추가된 비정상 저장은 기존 fail-closed 정규화에서 제외한다. 방문이나 과제 선택으로 완료를 주지 않는다.

## D08 — 제한된 코드 이력과 재실행 가능한 이어하기 (2026-10-09)

- 맥락: 사용자가 로컬 저장 확장을 승인하고 최근 코드·단계·장치 방향·조작·힌트·최고·진행 복원을 요청했다.
- 대안: 방향/점수만 저장 / 무제한 판별 로그 / 하나의 재실행 가능한 마지막 판과 제한된 완료 기록.
- 결정: light-route-session-v1에 schema=1, light-v2, light-run-v1 버전을 기록한다. 최근 코드 12개(마지막 단계·방식), 이어하기 1개, 완료 최고 기록 120개를 저장하며 전체 UTF-8 512KiB를 넘으면 오래된 완료 기록부터 제거한다. 회전·되돌리기·힌트 입력은 판별 최대 1,024개, 되돌리기는 최근 256회 회전이다. 초기 방문에는 저장하지 않고, 마지막 판이 있으면 이어하기를 명시적으로 선택한다. 코드/단계/방식 선택은 해당 단계의 처음 배치이며 마지막 복원 슬롯을 교체한다. 삭제는 자체 두 키를 제거한 뒤 빈 초기 화면을 보여준다.
- 이유: 방향만 복원하면서 점수·힌트 근거를 잃는 문제를 피한다. 순수 모델이 생성·합법 입력 재실행·방향/카운터 대조를 수행하며 UI와 저장 IO는 별도 경계에 둔다. 완료 기록도 재실행으로 검증한다. 저장 차단 시 화면 플레이를 유지하되 저장 실패를 알린다.
- 영향 파일: dist/src/session.js, storage.js, app.js, dist/index.html, test/session.test.js, architecture.md, README.md.
- 후속 검토: 메인에서 새로고침·이어하기·코드 선택·삭제·저장 차단의 실제 브라우저 동작을 확인한다. 복원은 v2/rulesVersion 일치만 허용한다. 기존 light-route-v1 최대 120개 최고 기록은 원래 영역에 유지하며 힌트 여부 미기록으로 표시하고 새 독립 완료에 편입하지 않는다. 보존 상한 때문에 제거된 완료는 새 진행 집계에서 제외된다.

## D09 — 같은 v2 배치의 선택형 제한 이동과 기록 분리 (2026-10-09)

- 맥락: 기본 어려운 18단계 캠페인을 보존하면서 이동 제한이 의미 있고 실제로 풀리는 도전 방식 요청.
- 대안: 모든 단계 동일 한도 / 초기 배치 변경 / 기존 배치의 합법 완료 경로 길이에 비례한 한도.
- 결정: 기본은 연습. 선택형 제한 이동은 생성된 초기 방향에서 필수 비고정 장치를 실제로 한 번씩 회전하며 광선 추적으로 완료를 검증한다. 검증된 경로 길이 + max(1,floor(길이/5))를 예산으로 제공한다. 마지막 허용 이동에 완료하면 성공, 미완료 한도 소진은 종료다. 되돌리기도 이동을 소비하며 힌트는 120점 감점/힌트 기록으로 보존된다. 연습/제한 이동 × 스스로 완료/힌트 사용 최고를 별도 키로 보관한다. 점수 원식 유지, 별·최소 이동 주장 제거. 기존 생성/seed 규칙은 변경하지 않는다.
- 이유: 고정 장치나 불가능한 한도로 인한 불공정성을 막고 실제 합법 입력으로 난도와 예산을 검증한다. 다른 짧은 유효 해답도 허용한다. hidden score injection이나 공개 랭킹 없음.
- 영향 파일: dist/src/session.js, model.js(문구만), app.js, dist/index.html, dist/styles.css, test/model.test.js, test/session.test.js, architecture.md, README.md.
- 후속 검토: 모든 단계 표본과 대체 배치의 합법 경로 및 초과 실패를 시험한다. 유일 해답·최소 이동 증명이나 사람 체감 난도는 주장하지 않는다. 메인에서 실제 모바일 버튼/키보드/완료 화면을 검증한다.

## D10 — 갤러리의 최소 기기 내 완료 요약 (2026-10-09)

- 맥락: 사용자 승인된 통합 계약은 web-lab-progress-v1의 최소 집계만 갤러리가 읽으며 서비스별 private run payload를 읽지 않도록 요구한다.
- 대안: 갤러리가 게임 로그 직접 읽기 / 방문·힌트 횟수 배지 / 실제 독립 완료 단계 수만 별도 요약.
- 결정: progress.js에 15개 서비스 ID를 명시한다: data-mirage, echo-vault, light-route, logic-foundry, neon-tactics, orbit-courier, packet-journey, parcel-panic, pixel-kitchen, pocket-city, route-race, sense-lab, swarm-garden, think-forge, traffic-lab. version=1/apps/서비스별 completed,total,updatedAt만 보존한다. 전체 8KiB 상한, 정수 0..total<=1000, 정규 ISO UTC 시각 검증. 자신의 durable 재실행 검증된 힌트 없는 완료에서 서로 다른 단계 수를 재계산(총18)하고 실제 저장 성공 후만 보고한다. 보존 정리로 수가 변하면 실제 완료 이벤트에서 조정한다. 초기 조회·이어하기·힌트·예시·단계 방문은 보고하지 않는다. 삭제는 다른 허용 서비스 집계를 유지하고 자기 항목만 제거한다.
- 이유: 코드/입력/사용자 이름/파일 내용이 공통 요약에 유출되지 않도록 한다. 저장 실패 또는 잘못된 공유 JSON은 안전하게 중단하고 사용자에게 실패를 알린다. 시간은 성공 이벤트 때 현재 기기 시각이며 가짜 과거 달성일을 만들지 않는다.
- 영향 파일: dist/src/progress.js, app.js, test/session.test.js, architecture.md, README.md.
- 후속 검토: 메인이 각 복사본 whitelist/계약을 대조한다. 이 작업은 light-route만 수정하며 web-lab·타 저장소·백엔드에 쓰지 않는다. localStorage의 탭 간 read-modify-write는 트랜잭션이 아니므로 동시 완료는 마지막 쓰기가 우선하며 추후 실제 완료에서 재계산한다.

## D01 — 독립 정적 사이트

- 맥락: 네 프로젝트를 별도 GitHub Pages 저장소로 공개 요청.
- 대안: 하나의 사이트 / 별도 서버 기반 사이트 / 독립 정적 사이트.
- 결정: 독립 저장소, 브라우저 JS, 외부 런타임 의존성 없음, dist만 배포.
- 이유: 기존 Pages 운영 방식 유지, 개인정보·운영비 최소화.
- 영향: package.json, dist/, workflow, architecture.md.
- 후속 검토: 공개 배포의 실제 브라우저 검증.

## D02 — 내 기기 기록과 전체 랭킹 구분

- 맥락: 사용자 랭킹 서버는 구축 의견 요청이며 신규 DB는 꼭 필요할 경우에만 허용.
- 대안: 즉시 DB 생성 / 가짜 랭킹 / 기기 내 기록과 서버 제안 분리.
- 결정: 현재 게임·학습 기록만 브라우저에 저장, 기록 삭제 제공. 외부 전송·계정·전역 랭킹 없음. 서버 제안은 구현 상태와 분리.
- 이유: Neon은 DB이며 공개 점수 제출을 검증할 API가 별도로 필요. 비용·보존·위변조 검증을 먼저 정해야 함.
- 영향: core.js, app.js, README.md.
- 후속 검토: 서버 권위 재현/런 티켓/속도 제한과 무료 한도 확정 후 연결.

## D03 — 재현 가능한 도전 코드

- 맥락: 반복 플레이는 무작위, 친구와 같은 문제·판 비교는 동일 조건 필요.
- 대안: Math.random만 사용 / 모든 판 고정 / seed 기반 생성.
- 결정: 새 판은 crypto 기반 seed; 같은 버전·설정·seed면 같은 초기 조건. 입력은 길이·문자 제한. 게임별 규칙 검증과 생성 시험.
- 영향: model, core, app, tests.
- 후속 검토: 클라이언트 점수는 전체 랭킹 증거로 신뢰하지 않음.

## D04 — 규칙과 작업 화면

- 맥락: 시각적인 소개보다 실제 학습·플레이 완주가 중심인 서비스 요청.
- 대안: 공통 카드형 소개 사이트 / 프로젝트별 직접 조작 화면.
- 결정: 정답 광선 경로를 먼저 구성하고 벽과 초기 회전을 생성했습니다. 점수는 조작·힌트 비용을 반영하되 최적 이동 수라고 부르지 않습니다. 광선 순환을 제한하고 목표 색을 글자와 함께 표시합니다.
- 이유: 학습과 플레이 결과를 재현하고 확인할 수 있게 함.
- 영향: dist/src/, dist/index.html, dist/styles.css, test/, README.md.
- 후속 검토: 공개 URL에서 조작과 작은 화면 검증. 기록 보존 범위 변경은 별도 결정 기록 필요.

## D05 — v2 경로 트리, 캠페인과 검증된 대체 배치 (2026-10-09)

- 맥락: 대부분 같은 네 거울 경로가 반복되어 난도가 낮다는 피드백. 로컬 구현만 승인되었으며 정적 구조를 유지해야 함.
- 대안: 기존 좌표만 변형 / 무작위 보드 생성 후 무제한 해답 탐색 / 해답 경로를 먼저 구성하는 제한된 생성.
- 결정: 4×4 논리 격자의 자기 교차 없는 경로·분기를 8×8에 투영한다. 최대 128회 시도하며 목표 수별 검증된 고정 경로로 대체한다. 생성마다 최종 해답의 모든 목표·경유지·센서 조건과 미완료 시작을 검사한다. 6개 장·18단계에 경유지, 다중 목표, 색 순서, 금지 센서, 고정 거울을 도입한다. 방해 장치는 정답 경로 밖에 놓고 센서는 잘못된 회전으로 도달 가능한 가까운 칸을 우선한다.
- 이유: 끝없는 생성과 불가능한 무작위 배치를 피하면서 경로 형태·장치 수·조건 종류를 확장한다. 유일 해답이나 최소 이동 수를 증명했다고 주장하지 않는다.
- 영향 파일: dist/src/model.js, dist/src/app.js, dist/index.html, test/model.test.js, README.md.
- 후속 검토: 메인 에이전트가 로컬 브라우저에서 난도 체감·힌트·모바일 플레이를 검증한다. 정적 트리 배치라는 제약은 유지되며 플레이어가 더 짧은 유효 해답을 찾으면 허용한다.

## D06 — 실행·저장 경계와 버전별 기록 (2026-10-09)

- 맥락: 새 생성 규칙의 기록을 이전의 쉬운 판 점수와 섞으면 비교가 잘못된다. 늘어난 장치·분기에도 실행 및 저장 사용량은 제한해야 한다.
- 대안: 이전 기록 삭제 / 별도 무제한 저장 영역 / 기존 저장 영역 내 버전 키 분리.
- 결정: 기존 light-route-v1 저장 영역의 항목 키에 light-v2 버전을 붙이고 총 120개 상한·사용자 삭제 기능을 유지한다. 예전 항목은 임의로 이전하지 않으며 상한 정리 또는 사용자가 삭제할 때 제거한다. 되돌리기 메모리는 최근 256개 회전으로 제한한다. 광선 처리는 8×8×4방향×2색 = 512개 상태로 제한하고 분기별 방문 이력으로 순환을 구분한다.
- 이유: 잘못된 점수 비교를 막고 기존 개인정보·보존 경계를 넓히지 않는다. 순수 모델에는 DOM·저장·네트워크 접근을 넣지 않는다. 기존 core의 순수 seed/검증 함수만 재사용한다.
- 영향 파일: dist/src/model.js, dist/src/app.js, dist/index.html, README.md, test/model.test.js.
- 후속 검토: 기존 기록이 있는 브라우저, 저장 차단 환경, 사용자 삭제와 256회 상한을 로컬 브라우저에서 확인한다. 백엔드·Neon·계정·외부 서비스·배포 변경은 없음.

## D07 — 대각선 시각화와 접근 가능한 진행 안내 (2026-10-09)

- 맥락: 슬래시 글자가 거울처럼 보이지 않으며 복합 목표에는 명확한 안내와 조작 피드백이 필요하다.
- 대안: 다른 글리프로 교체 / 외부 아이콘 이미지 / 직접 그리는 인라인 SVG와 의미 있는 텍스트.
- 결정: 거울은 실제 SVG 선, 분기는 대각선과 점선 원으로 그린다. 색 변환은 A/C 글자, 경유지는 마름모, 센서는 ×와 상태 문구를 함께 제공한다. 장별 과제·조건 수를 보드 앞에 배치한다. 회전 후 초점 유지, 행·열 화살표 이동, 좌표·방향·색의 텍스트 경로, 완료 체크·장 완료 메시지를 제공한다. 힌트는 방해 장치·고정 거울을 건너뛴다.
- 이유: 외부 자산 없이 글꼴에 따른 거울 모양 차이를 없애고 시각·색에만 의존하지 않는 정보를 제공한다.
- 영향 파일: dist/src/app.js, dist/index.html, dist/styles.css, dist/src/model.js, test/model.test.js.
- 후속 검토: 브라우저·보조기술 접근성은 이번 Node 검증으로 입증되지 않는다. 메인 에이전트가 실제 렌더링·키보드·작은 화면을 확인한다.
