# 2026-10-13 학습 과제의 근거

9/12/18단계 과제는 같은 코드·방식의 기존 배치에서 광선의 가지·색·제약을 추적하는 원문 연습이다. 새 생성 규칙이나 임의 난도 점수를 추가하지 않았다.

- 규칙의 1차 근거: [모델](../dist/src/model.js)의 trace/CAMPAIGN/makePuzzle, [실행](../dist/src/session.js)의 challengePlan/runStatus/applyAction.
- 실행 근거: [독립 추적기·생성·색·분기 시험](../test/model.test.js), [360개 제한 이동 완료·실패·복원 시험](../test/session.test.js).
- 색 변환은 게임에서 A/C를 덮어쓰는 규칙이며 경유지는 통과, 목표는 정지다. 18단계 qa-0의 합법 완료는 기존 검증 절차를 실제 UI에서 다시 실행했다.
