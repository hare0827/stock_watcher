# KIS 모의투자 연동 설계

**날짜:** 2026-03-27
**상태:** 승인됨

---

## 개요

한국투자증권(KIS) 모의투자 REST API를 연동해 보유 잔고를 자동 동기화하고 앱에서 직접 매수/매도 주문을 실행할 수 있도록 한다. API 키 보안을 위해 Railway에 Node.js 프록시 서버를 두고 앱은 서버를 통해서만 KIS와 통신한다.

---

## 전체 구조

```
앱 (React Native)
  ↕ HTTPS
Railway 서버 (Node.js/Express)  ← KIS API 키 보관
  ↕ HTTPS
KIS 모의투자 API (openapivts.koreainvestment.com:29443)
```

백엔드는 같은 레포 `/backend` 폴더에 추가한다.

---

## 구현 페이즈

| 페이즈 | 내용 | 완료 기준 |
|--------|------|-----------|
| 1 | 백엔드 서버 + KIS 인증 | Railway 배포, 토큰 발급 동작 |
| 2 | 잔고 동기화 | 앱 시작 시 holdings 자동 채워짐 |
| 3 | 주문 실행 | 앱에서 매수/매도 주문 완료 |

각 페이즈는 독립적으로 동작 확인 가능하다.

---

## 백엔드 API

### 환경변수 (Railway)

```
KIS_APP_KEY=...
KIS_APP_SECRET=...
KIS_ACCOUNT_NO=...     # 모의투자 계좌번호 (XXXXXXXXXX-XX 형식)
KIS_IS_PAPER=true
```

### 토큰 관리

- KIS 토큰 유효기간: 24시간
- 서버 메모리에 캐싱, 만료 10분 전 자동 갱신
- 앱은 토큰을 직접 다루지 않음

### 엔드포인트

#### `POST /auth/token`
KIS 토큰 발급. 앱 시작 시 또는 연결 테스트 시 호출.

Response:
```json
{ "ok": true }
```

#### `GET /balance`
보유 잔고 조회. KIS 응답을 앱의 `Holding[]` 형식으로 변환해 반환.

KIS 잔고 API는 종목별 **평균매입가**와 **보유수량**을 반환하며, 개별 매수일은 제공하지 않는다. 서버는 조회 날짜를 `purchaseDate`로 사용하고 종목당 하나의 `Holding`으로 변환한다.

Response:
```json
{
  "holdings": [
    {
      "id": "kis_005930.KS",
      "ticker": "005930.KS",
      "shares": 10,
      "pricePerShare": 56000,
      "currency": "KRW",
      "type": "buy",
      "purchaseDate": "2026-03-27"
    }
  ]
}
```

#### `POST /order`
매수/매도 주문 실행.

Request:
```json
{
  "ticker": "005930.KS",
  "shares": 5,
  "orderType": "buy" | "sell"
}
```

Response:
```json
{ "orderId": "0000123456", "status": "accepted" }
```

#### `GET /order/:orderId`
주문 체결 상태 조회.

Response:
```json
{ "orderId": "0000123456", "status": "filled" | "pending" | "rejected" }
```

### 국내/해외 자동 라우팅

서버에서 ticker를 보고 KIS API 엔드포인트를 자동 선택:
- `.KS` suffix → 국내주식 API (`/uapi/domestic-stock/...`)
- 나머지 → 해외주식 API (`/uapi/overseas-price/...`)

---

## 앱 변경사항

### 파일 맵

| 파일 | 작업 |
|------|------|
| `backend/src/index.ts` | 신규 — Express 서버 진입점 |
| `backend/src/kis.ts` | 신규 — KIS API 클라이언트 |
| `backend/src/routes/balance.ts` | 신규 — 잔고 라우트 |
| `backend/src/routes/order.ts` | 신규 — 주문 라우트 |
| `src/stores/kisStore.ts` | 신규 — 백엔드 URL, 연결 상태, 주문 함수 |
| `src/api/kis.ts` | 신규 — 앱→백엔드 API 클라이언트 |
| `app/(tabs)/settings.tsx` | 수정 — KIS 연결 설정 UI 추가 |
| `app/(tabs)/portfolio.tsx` | 수정 — 잔고 동기화 트리거 |
| `app/stock/[ticker].tsx` | 수정 — 주문 UI 추가 |

### `useKisStore`

```typescript
interface KisState {
  backendUrl: string | null;       // 예: "https://my-app.railway.app"
  isConnected: boolean;
  setBackendUrl: (url: string) => Promise<void>;
  testConnection: () => Promise<boolean>;
  syncBalance: () => Promise<void>;
  placeOrder: (ticker: string, shares: number, type: 'buy' | 'sell') => Promise<string>;
}
```

### Settings 화면

- 백엔드 URL 입력 필드
- "연결 테스트" 버튼 → `POST /auth/token` 호출
- 연결 상태: `● 연결됨` (초록) / `● 미연결` (빨강)
- URL은 AsyncStorage에 저장

### Holdings 동기화

- 앱 시작 시 (`_layout.tsx` hydrate 타이밍) + 포트폴리오 탭 포커스 시 → `GET /balance` 호출
- 응답으로 받은 `Holding[]`로 `holdingsStore` 전체 교체
- KIS 미연결 상태이면 동기화 스킵 → 기존 수동 입력 그대로 유지

### 주문 UI (종목 상세 화면)

KIS 연결 여부와 무관하게 주문 폼은 항상 표시한다:

- **미연결 시:** 입력 필드 비활성화(`editable={false}`) + 상단에 경고 배너
  ```
  ⚠️  KIS 미연결 — 설정에서 연결해주세요
  ```
- **연결 시:** 수량 입력 → "매수" / "매도" 버튼 → 확인 모달 → 주문 실행 → 잔고 재조회

주문 확인 모달:
```
NVDA 5주 매수
예상 금액: $892.50

[취소]  [확인]
```

주문 완료 후 `syncBalance()` 자동 호출.

---

## 에러 처리

| 상황 | 처리 |
|------|------|
| Railway 서버 다운 | 연결 상태 `미연결`로 표시, 수동 모드 유지 |
| KIS 토큰 만료 | 서버에서 자동 갱신, 앱은 투명하게 재시도 |
| 주문 실패 (잔액 부족 등) | KIS 에러 메시지 토스트로 표시 |
| 해외주식 시장 마감 | KIS 에러 응답 그대로 사용자에게 전달 |

---

## 테스트 전략

- 백엔드: Jest + supertest로 각 라우트 단위 테스트
- KIS API 호출은 mock 처리 (모의투자 키 없이 CI 가능)
- 앱: `kisStore` 유닛 테스트, 주문 UI 컴포넌트 테스트
