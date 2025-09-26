# Gomoku App v2

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

