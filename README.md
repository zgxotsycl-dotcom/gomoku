# Gomoku App v2


## AI Inference Server (optional)

This repo includes a lightweight AI server that implements the endpoints the app expects:

- POST /swap2/propose
- POST /swap2/second
- POST /swap2/choose
- POST /get-move

By default it uses simple heuristics so the game never blocks. You can hot‑load your own engine by dropping files under `MODEL_DIR/current/` (see below).

### Start locally

```
# AI server
npm run start:ai

# (optional) model watcher
# ENV: MODEL_MANIFEST_URL, MODEL_BASE_URL, MODEL_DIR, POLL_INTERVAL_MS
npm run start:watcher
```

Environment variables:

- AI_PORT (default 8081)
- MODEL_DIR (default ./models)
- MODEL_MANIFEST_URL (e.g. https://storage.googleapis.com/omokk-models/models/manifest.json)
- MODEL_BASE_URL (e.g. https://storage.googleapis.com/omokk-models)
- POLL_INTERVAL_MS (default 60000)

Point the Next.js app to this server on Vercel:

```
SWAP2_SERVER_URL=https://ai.omokk.com
SWAP2_SERVER_TIMEOUT_MS=6000
```

### Custom engine hot‑load

If a file `MODEL_DIR/current/engine.js` exists, the AI server will require() it every ~10s and use it for moves.

Minimal engine interface:

```js
// MODEL_DIR/current/engine.js
module.exports = {
  evaluate(board, toMove) {
    return { move: [7, 7], score: 0 };
  },
};
```
본 프로젝트는 Next.js 기반 오목(Gomoku) 애플리케이션입니다. 이 문서는 Swap2 규칙, AI 프록시, 환경변수 및 QA 용 설정에 대해 설명합니다.

## 환경 변수

- 필수 (빌드/런타임)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- AI 서버 프록시 (중 하나만 설정해도 동작)
  - `SWAP2_SERVER_URL` (예: `https://gomoku-2-1qjl.onrender.com`)
  - `NEXT_PUBLIC_AI_BASE_URL`

- 선택 (기본값 포함)
  - `NEXT_PUBLIC_SWAP2_RANDOM_START` (기본 `true`) — `false`면 표준 시작(두 번째 선수 선택 UX)
  - `NEXT_PUBLIC_COLOR_SELECT_TIMEOUT_MS` (기본 `7000`) — 색상 선택 제한시간(ms)
  - `NEXT_PUBLIC_SWAP2_BANNER_MS` (기본 `3000`) — 배너 표시시간(ms)

## 헬스체크

- `GET /api/healthz`
  - `{ ok: true, aiConfigured: boolean, supabaseConfigured: boolean }` 반환

## Swap2 동작 요약

- 로딩 오버레이 동안 Swap2 제안(/api/swap2/propose)과 2차 결정(/api/swap2/second)을 선요청(프리페치)
- 표준 시작 모드(false): 컬러 선택 모달 자동 오픈 (프리페치 완료 후)
- 랜덤 시작 모드(true): 색상 자동 선택
- Option 2(스왑) 이후 다음 수는 항상 백
- Option 3(두 수 더) 이후 다음 수는 항상 백, 두 번째 선수가 색상 선택
  - 두 번째 선수가 AI인 경우 `/api/swap2/choose` 결과로 즉시 적용

## QA/데모용 런타임 설정

- 설정창(메인 화면 → 설정)에서 다음을 변경 후 저장
  - 랜덤 시작 토글
  - 색상 선택 제한시간(ms)
  - 배너 표시시간(ms)
- 저장 시 localStorage에 반영되며 현재 화면에 즉시 반영됩니다.

## 테스트

```bash
npm test
```

주요 시나리오가 `src/components/__tests__/Board.swap2.test.tsx`에 포함되어 있습니다.
