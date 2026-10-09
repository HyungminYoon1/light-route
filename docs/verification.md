# 검증 기록

## 2026-10-09 — 코드 이력·이어하기·제한 이동·갤러리 요약

### LOCAL_MODEL / STATIC — PASS

- Node.js v22.23.2 / PowerShell 7.6.6. `npm test`: 22개 시험 통과. `npm run check`: 배포 상대 자산 및 JS 구문 PASS. 새 외부 의존성 없음.
- 기존 모델 시험 13개를 유지하며 144개 대체 배치 시험에 실제 회전 경로와 독립 BFS 판정 비교를 추가했다. 생성 seed/배치/점수 원식 변경 없음. model.js 변경은 장 안내 문구뿐이다.
- 18단계×20코드 = 360개 제한 이동 판에서 실제 합법 회전으로 예산 안 완료·힌트0·완료 재실행을 확인하고, 각각 미완료 회전으로 한도를 소진한 뒤 추가 입력 거부·기록 없음·실패 복원을 확인했다.
- 마지막 허용 조작 완료, 완료 후 추가 입력 거부, 18단계×2모드 복원 round-trip, 방향·moves·hints 일치, 되돌리기 복원, 고정/범위 밖 회전·임의 점수 입력·잘못된 버전/코드/단계/방식 거부를 확인했다.
- 256회 되돌리기/1,024회 입력, 최근 코드12/완료120/UTF-8 512KiB 상한, 저장 차단·oversize·손상 JSON·버전 불일치, 자체 두 저장 키만 삭제를 확인했다. 긴 합법 힌트 재실행 기록으로 byte 상한에 의한 제거를 시험했다.
- 연습/제한 이동 및 독립/힌트 기록 분리, 방문/힌트만으로 독립 완료0, 같은 단계 여러 방식 중복 집계 방지. 공유 요약은 15 whitelist, 실제 완료 집계 필드만 보존, 정수/ISO 날짜 검증, 다른 앱 요약 유지와 자기 항목 삭제, 손상 공유 저장 실패를 시험했다. storage stub 검증이며 실제 브라우저 저장 증거가 아니다.
- 변경 텍스트13개 UTF-8 유효·BOM 없음·CRLF 및 `git diff --check` 확인. app의 모든 고정 DOM ID가 HTML에 있는지 정적으로 검사했다. 아래 13회 실패 및 11회 완료 좌표 순서는 Node 실제 입력으로 확인했다. CSP/외부 연결 경계 유지.

### BROWSER / PREVIEW / REMOTE_CI / LIVE — NOT_RUN

- 메인이 실제 브라우저/모바일/E2E/캡처/통합/공개를 담당한다. 담당 에이전트는 브라우저·계정·프로비저닝·commit/push/배포를 실행하지 않았다.
- 로컬 실행: 저장소에서 `npm run dev -- 0`, 출력된 loopback URL로 접속. 재현 코드 `qa-0`을 시작하고 진행 방식 `제한 이동`, 단계18을 선택한다. 총13회 예산이며 기본 v2 배치이다.
- 힌트를 누르지 않고 다음 좌표(행,열)를 각각 한 번 클릭하면 실제 11회 조작으로 완료한다: (8,7), (6,7), (8,5), (8,3), (4,3), (8,1), (4,4), (7,1), (3,7), (2,4), (7,7). 앞10회 후 캡처하면 목표4/4·경유지0/4·센서0·남은3회와 분기·색 장치·고정 거울이 보이는 실제 미완료 화면이다. 마지막 (7,7)을 클릭하면 경유지4/4·완료11회/힌트0/남은2회/최고·진행을 캡처한다.
- 복원 QA: 앞 여섯 번 진행 후 새로고침 → 저장 안내의 조작6회/힌트0 확인 → 이어하기 → 같은 방향/남은7회/되돌리기 가능 확인. 다음 다섯 회로 완료하면 요약이 실제 독립 단계1/총18로 저장되어야 한다. 새로고침·이어하기가 updatedAt을 갱신하지 않는지 확인한다.
- 힌트 분리 QA: 처음 배치 → 힌트 클릭 후 표시 장치를 실제 클릭하는 흐름으로 완료 → 힌트 최고만 갱신되고 독립 완료 집계는 증가하지 않아야 한다. 연습으로 전환하면 제한 이동 최고와 분리한다.
- 실패 QA: 처음 배치 → (8,7)을 반복13회 클릭(다른 필수 장치는 그대로) → 조작 한도 종료, 추가 조작/힌트/되돌리기 불가, 새 완료 기록 없음. 처음 배치로 재시작 가능.
- 저장/삭제 QA: 새 세트/최근 코드/코드 입력/단계 선택, 최근 코드12 제한, 확인창 취소·삭제 모두 확인. 다른 앱의 유효 집계가 있으면 삭제 뒤 해당 앱 요약 유지, light-route 항목/자체 두 키 제거를 확인한다. 삭제 직후 자동 저장 없음. 저장 차단 시 플레이는 계속되며 실패 알림이 있고 갤러리에 완료를 보고하지 않아야 한다.
- 320px/390px 화면에서 select/코드·버튼·13회 예산·실제 보드 스크롤 및 가로 넘침, Tab/Enter/Space/화살표/초점 유지를 검증한다. 보드 각 칸의 물리 크기는 8×8 격자에 따른 것으로 모든 칸이 44px라고 주장하지 않는다.

### 입력 검토 범위

- VERIFIED: 지정 light-route의 architecture.md, README.md, docs/decisions.md, docs/verification.md, package.json, .gitattributes, .gitignore, dist/index.html/styles.css/src/model.js/app.js/core.js/favicon.svg, test/model.test.js, tools/check.mjs/serve.mjs. api-spec.md/requirements.md는 존재하지 않음을 확인했다. 새 session.js/storage.js/progress.js 및 session.test.js는 작성 후 검사했다.
- PARTIAL: 저장소 전체 파일 목록·git status를 확인하고 위 관련 입력을 전체 검토했다. .git 내부, node_modules와 기존 배포 workflow 내용은 선택하지 않았다. 부모 폴더는 요약 allowlist15 ID 확인을 위한 디렉터리 이름만 조회했으며 다른 서비스 소스는 읽거나 수정하지 않았다.
- 최초 git status는 clean이었다. light-route 외 저장소 변경, 다른 에이전트 생성, 외부 서비스 접속 없음. 모든 가능한 코드·유일/최소 해답·실제 모바일 렌더링·원격 상태는 이 시험으로 입증하지 않는다.

### 변경 경로

- 새 파일: dist/src/session.js(순수 실행/복원/보존), dist/src/storage.js(자체 저장 IO), dist/src/progress.js(공통 요약 IO), test/session.test.js(9개 추가 시험).
- 수정 앱: dist/src/app.js, dist/src/model.js(장 문구만), dist/index.html, dist/styles.css.
- 수정 검사/문서: test/model.test.js(기존 시험 유지·대체 경로 검증 추가), architecture.md, README.md, docs/decisions.md(D08–D10), docs/verification.md.

## 2026-10-09 — 로컬 v2 난도 확장

이번 변경은 LOCAL IMPLEMENTATION ONLY이며 아래의 2026-10-08 공개 검증은 이전 v1에 대한 이력입니다. 새 v2의 브라우저·원격 CI·배포 증거로 해석하지 않습니다.

### LOCAL_MODEL / STATIC — PASS

- 환경: Windows PowerShell 7, Node.js v22.23.2. 기존 `npm test`, `npm run check` 사용. 새 의존성 없음.
- Node 시험 13개 통과. 18단계 × 100개 seed = 1,800개 퍼즐에서 결정성·정수 좌표·장치/목표/경유지/센서/벽 중첩 없음·미완료 시작을 검사했다.
- 생성기의 trace를 재사용하지 않는 방향표·BFS 참조 추적기로 각 퍼즐의 정답/초기/반전 배치, 총 5,400개 상태의 목표·경유지·센서 판정을 대조했다. 정답 배치는 모든 조건 충족.
- 최대 128번 생성 시도를 강제로 0번으로 제한한 18단계 × 8개 seed = 144개 대체 배치도 독립 추적기에서 도달 가능하며 초기에는 미완료.
- 난도/다양성 표본: 18단계 × 64개 seed = 1,152개. 단계마다 64개 중 최소 50개 이상의 서로 다른 경로 장치 좌표/종류 조합. 후반 13개 이상의 정답 경로 장치, 네 목표, 네 경유지, 고정 거울 수 검사. 센서 단계에서는 잘못된 단일 회전으로 실제 센서가 작동하는지 검사.
- 18단계 × 20개 seed = 360개에서 방해 장치 방향도 바꾼 뒤 힌트를 따라 완료 가능. 고정/방해 장치 제외, 퍼즐 원본 비변경 확인.
- 별도 규칙 시험: 거울 4방향×2회전, 분기의 직진·반사, 모든 목표를 켜도 금지 센서 또는 누락/오색 경유지가 있으면 미완료, 목표/벽의 흡수, 색 덮어쓰기, 실제 순환 종료, 단순 합류의 순환 오판 방지, 조밀한 분기의 512상태 상한, 회전 가역성·고정·입력/점수 경계.
- `npm run check`: 배포 자산 상대 경로 및 JavaScript 구문 검사 통과. `git diff --check`, 변경 텍스트 UTF-8 유효성·BOM 없음·CRLF 확인.

### BROWSER / PREVIEW / REMOTE_CI / LIVE — NOT_RUN

- 이번 담당 작업에서 브라우저 실행·화면 캡처·모바일 렌더링·보조기술 QA·프리뷰 서버 실행을 하지 않았다. 메인 에이전트가 로컬 프리뷰와 브라우저 QA를 담당한다.
- 미실행 UI 확인 항목: SVG 거울/분기 선, 320px/390px 화면, Tab/Enter/Space·화살표·회전 후 초점, 힌트/되돌리기/초기화, 단계 완료와 다음 장, 텍스트 광선 경로, 저장 차단·기록 삭제·256회 되돌리기 상한.
- 메인 QA 재현 코드 제안: `qa-0`. 4단계 경유지, 9단계 3목표, 12단계 색 조건, 15단계 센서, 18단계 4목표·고정 거울을 확인할 수 있다. 각 단계의 힌트는 검증된 해답으로 안내한다.
- commit/push/deploy/원격 변경/백엔드/Neon/외부 자산·서비스 호출 없음. 변경은 이 저장소에만 있다.

### 입력 검토 범위와 한계

- VERIFIED: architecture.md, README.md, docs/decisions.md, .gitattributes, dist/index.html, dist/styles.css, dist/src/model.js·app.js·core.js, dist/favicon.svg, test/model.test.js, package.json, tools/check.mjs·serve.mjs, docs/verification.md의 관련 기존 내용 전체.
- PARTIAL: 저장소 전체는 파일 목록을 확인한 뒤 위 직접 관련 파일을 선택했다. .git 내부·node_modules 캐시·변경하지 않는 배포 workflow 내용은 검토하지 않았다. 디렉터리 목록 확인을 파일 전체 검토로 간주하지 않는다.
- 난도는 경로 장치 수·목표·제약과 다양성으로 검증했다. 사람의 체감 난도, 모든 가능한 seed, 유일 해답, 최소 조작 횟수는 전수 증명하지 않았다. 독립 참조 모델 시험은 브라우저/실서비스 증거가 아니다.

## 이전 v1 검증 이력 — 2026-10-08

검증일: 2026-10-08 (KST). 증거 상태를 분리합니다.

## LOCAL — PASS

- Node 순수 모델 시험 4개 통과. 12단계 × 20개 seed = 240퍼즐의 정답 배치 완료 및 초기 미완료 확인. 회전·색·점수 경계·광선 순환 종료 검증.
- IAB 실제 조작: 1단계 거울 변경·되돌리기·힌트·완료(580점) 확인.
- 9단계 광선 분기와 색 변환으로 A/C 두 목표 모두 켜짐, 완료(730점) 확인.
- WebMCP: 정상 단계·코드 선택 반영; 허용하지 않는 seed 거부.
- 데스크톱 기본 뷰포트와 390×844, 320×720 모바일 뷰포트에서 확인. 문서 가로 넘침 없음(모바일 스크롤바 제외 콘텐츠 폭 375/305px). LIGHT ROUTE 단계 선택 줄은 의도적으로 내부 가로 스크롤.
- 확인한 브라우저 흐름의 warn/error 로그 0개. 배포 직전 npm test와 npm run check 재실행 PASS.
- UTF-8 유효성·BOM 없음·CRLF 정규화 확인. 환경 파일 없음, 일반적인 토큰/DB URL 패턴 검사에서 일치 없음(포괄적인 보안 감사는 아님).

## REMOTE_CI — PASS

- [GitHub Actions 시험·검사·배포 성공](https://github.com/HyungminYoon1/light-route/actions/runs/37790254330)
- 검증한 앱 소스 커밋: 49c713f45ca0de0abe1dc02d5fbeacf0d817ef0d. verify의 npm test/npm run check 및 deploy 모두 success 확인.
- 이 검증 기록의 후속 갱신은 문서만 변경하며 dist 앱 소스는 동일합니다.

## LIVE — PASS

- [공개 사이트](https://hyungminyoon1.github.io/light-route/) HTTPS 접속 확인.
- dist의 6개 파일(HTML/CSS/app/core/model 또는 questions/favicon) HTTP 200 및 로컬 SHA-256 바이트 일치.
- 9단계 QA-color에서 화면 힌트와 장치 클릭으로 A/C 두 목표 완성, 730점 확인.
- 확인한 공개 흐름의 warn/error 로그 0개. 기본 화면·전체 화면 JPEG 증거는 별도 로컬 QA 폴더에 저장했고 공개 저장소에 개인 PC 경로나 QA 기록을 올리지 않음.

## 범위와 한계

모든 가능한 생성 판이나 모든 문항 의미를 전수 증명한 것은 아닙니다. 자동 시험은 표본 생성과 규칙 검증이고 실제 브라우저 시험은 위에 명시한 흐름입니다. 전체 사용자 랭킹·서버·Neon DB·API 부하 시험은 NOT_IMPLEMENTED/NOT_RUN입니다. 기록 삭제 버튼은 확인 창과 구현을 검토했으나 이번 QA에서 실제 삭제하지 않았습니다.
