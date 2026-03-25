# 포트폴리오 손익 추적 기능 설계

**날짜:** 2026-03-26
**상태:** 승인됨

---

## 개요

Stock Watcher 앱에 포트폴리오 손익 추적 기능을 추가한다. 사용자가 종목별 매수 내역(날짜, 주수, 매수가)을 복수로 입력하면, 현재가 기준으로 손익을 계산해 종목 상세 화면에 표시한다. 미국 주식의 손익은 매수일/현재 환율을 적용해 원화로 환산한다.

---

## 요구사항

- 종목별 매수 내역을 여러 건 입력 가능 (날짜, 주수, 매수가)
- 매수 내역 삭제 가능 (롱프레스 → 확인 Alert)
- 종목 상세 화면(`app/stock/[ticker].tsx`) 하단에 "내 보유 현황" 섹션 표시
  - 매수 내역 목록: 날짜 / 주수 / 매수가 / 개별 손익
  - 섹션 상단에 해당 종목 총 손익 + 수익률(%) 표시
- 손익은 원화(KRW)로 표시
  - KRW 종목: 변환 없음
  - USD 종목: 매수일 환율로 원가 환산, 현재 환율로 현재가 환산
- 홈 화면 StockCard는 변경 없음 (현재가/등락률만 표시)

---

## 데이터 모델

```typescript
interface Holding {
  id: string;              // UUID (Math.random 기반 간단 생성)
  ticker: string;
  shares: number;          // 매수 주수 (양의 정수만 허용)
  pricePerShare: number;   // 매수가 (USD 종목은 USD, KRW 종목은 KRW)
  purchaseDate: string;    // 'YYYY-MM-DD', 오늘 이하만 허용
  currency: 'KRW' | 'USD'; // 입력 시 ticker 기반으로 자동 결정
}
```

**통화 판별 기준:** ticker가 `.KS` 또는 `.KQ`로 끝나면 `KRW`, 그 외 `USD`.

---

## 아키텍처

### 새 파일

| 파일 | 역할 |
|------|------|
| `src/stores/holdingsStore.ts` | Zustand + AsyncStorage, `Record<ticker, Holding[]>` |
| `src/hooks/useHoldingPnL.ts` | 종목별 손익 계산 훅 |

### 변경 파일

| 파일 | 변경 내용 |
|------|-----------|
| `src/api/yahoo.ts` | `fetchExchangeRate(date: string): Promise<number>` 추가 (`KRW=X` 티커) |
| `app/stock/[ticker].tsx` | 하단에 "내 보유 현황" 섹션 추가 |
| `src/stores/stocksStore.ts` | `removeStock` 시 `holdingsStore.clearHoldings(ticker)` 호출 |

### holdingsStore 인터페이스

```typescript
interface HoldingsState {
  holdings: Record<string, Holding[]>; // ticker → Holding[]
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addHolding: (holding: Holding) => void;    // 추가 후 AsyncStorage.setItem 호출
  removeHolding: (ticker: string, id: string) => void; // 제거 후 AsyncStorage.setItem 호출
  clearHoldings: (ticker: string) => void;   // 종목 전체 제거 후 AsyncStorage.setItem 호출
  getHoldings: (ticker: string) => Holding[];
}
// AsyncStorage 키: '@holdings'
// addHolding / removeHolding / clearHoldings 각각 작업 후
// AsyncStorage.setItem('@holdings', JSON.stringify(nextState)) 호출
```

### 환율 조회 (`src/api/yahoo.ts`)

기존 `fetchYahooChart(ticker, range)` 내부 함수를 재사용해 `KRW=X` 티커로 조회한다.

```typescript
// 현재 USD→KRW 환율 (실시간)
// fetchYahooChart('KRW=X', '5d') → meta.regularMarketPrice
fetchCurrentExchangeRate(): Promise<number>

// 특정일 USD→KRW 환율 (과거)
// fetchYahooChart('KRW=X', '2y') → timestamps 배열에서 date 이전 가장 가까운 close 값
fetchHistoricalExchangeRate(date: string): Promise<number>
```

**React Query 캐시 키 및 staleTime:**
- 현재 환율: `['fx', 'now']`, `staleTime: 60_000` (1분)
- 과거 환율: `['fx', date]`, `staleTime: Infinity` (과거 환율은 불변)

**주말/공휴일 처리:** `fetchHistoricalExchangeRate`는 Yahoo Finance가 반환한 timestamp 배열에서 요청 날짜 이전의 가장 가까운 데이터를 사용한다. (영업일 기준 자동 fallback)

**API 오류 시:** `useHoldingPnL`이 `isError: true` 반환, UI에서 "환율 조회 실패 — 손익 계산 불가" 표시

### 손익 계산 (`useHoldingPnL`)

```
KRW 종목:
  원가 = shares × pricePerShare
  현재가치 = shares × currentPrice
  손익 = 현재가치 - 원가

USD 종목:
  원가(KRW) = shares × pricePerShare × fxRateAtPurchase
  현재가치(KRW) = shares × currentPrice × fxRateNow
  손익 = 현재가치(KRW) - 원가(KRW)

종목 전체 합산:
  totalCost = Σ 각 매수건 원가(KRW)
  totalValue = Σ 각 매수건 현재가치(KRW)
  totalPnL = totalValue - totalCost
  pnlPercent = totalPnL / totalCost × 100
```

**훅 반환값:** `{ totalPnL, pnlPercent, perHolding: { id, pnl }[], isLoading, isError }`

### 입력값 검증 (모달)

| 필드 | 검증 조건 |
|------|-----------|
| 날짜 | 오늘 이하 (미래 날짜 불가) |
| 주수 | 양의 정수 (1 이상, 소수점 불허) |
| 매수가 | 양수 (0 초과) |

---

## UI 구조

### 종목 상세 화면 (`app/stock/[ticker].tsx`)

기존 차트 섹션 아래에 추가:

```
─────────────────────────────
내 보유 현황
총 손익: +₩234,500 (+12.4%)
─────────────────────────────
2025-01-15  10주  $650.00   +₩180,000
2025-06-01   5주  $720.00   + ₩54,500
─────────────────────────────
[+ 매수 내역 추가]
```

- 각 행 롱프레스 → 삭제 확인 Alert
- "+ 매수 내역 추가" → 하단 모달 (날짜 입력, 주수 입력, 매수가 입력)
- 환율 오류 시: 손익 수치 대신 "환율 조회 실패 — 손익 계산 불가" 텍스트 표시

### 종목 삭제 시 정리

`stocksStore.removeStock`에서 `holdingsStore.getState().clearHoldings(ticker)` 호출

---

## 제외 범위 (YAGNI)

- 배당금 추적
- 멀티 포트폴리오 (계좌별 분리)
- 수익률 차트
- 세금 계산
- 소수점 주수 지원
