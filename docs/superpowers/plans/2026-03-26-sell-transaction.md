# Sell Transaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 주식 상세 화면에 매도 내역 추가 기능을 구현하고, 매수+매도를 합산한 총 손익(실현+미실현)을 계산한다.

**Architecture:** `Holding` 타입에 `type: 'buy' | 'sell'` 필드를 추가하고, 기존 `holdingsStore`를 그대로 재사용한다. `useHoldingPnL`과 `usePortfolioSummary` 계산식을 확장해 매도 거래를 반영하고, 상세 화면에 매도 모달과 분리된 매수/매도 목록을 추가한다.

**Tech Stack:** React Native, TypeScript, Zustand (`useHoldingsStore`), TanStack React Query v5, jest-expo + @testing-library/react-native

---

## File Map

| 파일 | 작업 |
|------|------|
| `src/types/index.ts` | 수정 — `Holding`에 `type: 'buy' \| 'sell'` 추가 |
| `src/hooks/useHoldingPnL.ts` | 수정 — 매도 거래 반영 PnL 계산 |
| `src/hooks/usePortfolioSummary.ts` | 수정 — 매도 거래 반영 집계 |
| `app/stock/[ticker].tsx` | 수정 — 매도 모달 + 분리 표시 UI |
| `__tests__/hooks/useHoldingPnL.test.ts` | 신규 — hook 단위 테스트 |
| `__tests__/hooks/usePortfolioSummary.test.ts` | 수정 — 매도 케이스 테스트 추가 |

---

## Task 1: Holding 타입 + useHoldingPnL 업데이트

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/hooks/useHoldingPnL.ts`
- Create: `__tests__/hooks/useHoldingPnL.test.ts`

### PnL 계산 공식

```
totalValue = (순보유량 × 현재가 × fxNow) + Σ매도대금KRW
totalCost  = Σ매수비용KRW
totalPnL   = totalValue - totalCost
```

구현에서:
1. **buys** 루프: `totalCost += shares × price × fx`, `totalCurrentValue += shares × currentPrice × fxNow`
2. **sells** 루프: `totalCurrentValue -= shares × currentPrice × fxNow`, `totalSellProceeds += shares × price × fxAtSell`
3. `totalValue = totalCurrentValue + totalSellProceeds`

매도가 있으면 `perHolding`은 빈 배열 반환 (avg cost 방식과 혼용 시 혼란 방지).

---

- [ ] **Step 1: 테스트 파일 생성 (failing)**

```typescript
// __tests__/hooks/useHoldingPnL.test.ts
import { renderHook } from '@testing-library/react-native';
import { useHoldingPnL } from '../../src/hooks/useHoldingPnL';
import { Holding } from '../../src/types';

jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueries: () => [],
}));

const makeBuy = (overrides: Partial<Holding> = {}): Holding => ({
  id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100,
  purchaseDate: '2024-01-15', currency: 'KRW', type: 'buy', ...overrides,
});

it('보유 내역 없으면 totalPnL=0, isLoading=false', () => {
  const { result } = renderHook(() => useHoldingPnL([], 0));
  expect(result.current.totalPnL).toBe(0);
  expect(result.current.isLoading).toBe(false);
});

it('KRW 매수만 있으면 미실현 손익 계산', () => {
  const holdings = [makeBuy({ shares: 10, pricePerShare: 100 })];
  const { result } = renderHook(() => useHoldingPnL(holdings, 150));
  expect(result.current.totalPnL).toBe(500); // 10 × (150 - 100)
  expect(result.current.perHolding).toHaveLength(1);
  expect(result.current.perHolding[0].pnl).toBe(500);
});

it('KRW 매도 있으면 실현+미실현 합산, perHolding 비움', () => {
  const holdings: Holding[] = [
    makeBuy({ id: '1', shares: 10, pricePerShare: 100 }),
    makeBuy({ id: '2', shares: 3, pricePerShare: 150, type: 'sell' }),
  ];
  const { result } = renderHook(() => useHoldingPnL(holdings, 160));
  // buys: cost=1000, currentValue=1600
  // sells: currentValue -= 480 → 1120, sellProceeds=450
  // totalPnL = (1120 + 450) - 1000 = 570
  expect(result.current.totalPnL).toBe(570);
  expect(result.current.perHolding).toHaveLength(0);
});

it('type 없는 기존 holding은 buy로 간주', () => {
  const holding = {
    id: '1', ticker: 'TEST', shares: 5, pricePerShare: 200,
    purchaseDate: '2024-01-01', currency: 'KRW' as const,
    // type 필드 없음 (하위 호환 테스트)
  } as Holding;
  const { result } = renderHook(() => useHoldingPnL([holding], 300));
  expect(result.current.totalPnL).toBe(500); // 5 × (300 - 200)
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /Users/hare/vibecoding_project/02_stock_tracker/stock-watcher
pnpm test __tests__/hooks/useHoldingPnL.test.ts --watchAll=false
```

Expected: FAIL — `Holding` 타입에 `type` 필드 없음 + hook 로직 미반영

- [ ] **Step 3: `src/types/index.ts` 수정 — `type` 필드 추가**

```typescript
// src/types/index.ts
export interface Holding {
  id: string;
  ticker: string;
  shares: number;
  pricePerShare: number;
  purchaseDate: string;    // 'YYYY-MM-DD' (매수일 또는 매도일)
  currency: 'KRW' | 'USD';
  type: 'buy' | 'sell';   // 없으면 'buy'로 간주 (하위 호환)
}
```

나머지 타입(`Stock`, `AlertConfig`, `StockQuote`, `CandleData`, `Period`, `CardStatus`, `AlertEvent`)은 그대로 유지.

- [ ] **Step 4: `src/hooks/useHoldingPnL.ts` 수정**

```typescript
// src/hooks/useHoldingPnL.ts
import { useQuery, useQueries } from '@tanstack/react-query';
import { Holding } from '../types';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';

export interface HoldingPnLResult {
  totalPnL: number;
  pnlPercent: number;
  perHolding: { id: string; pnl: number }[];
  isLoading: boolean;
  isError: boolean;
}

export function useHoldingPnL(
  holdings: Holding[],
  currentPrice: number
): HoldingPnLResult {
  const empty: HoldingPnLResult = {
    totalPnL: 0, pnlPercent: 0, perHolding: [], isLoading: false, isError: false,
  };

  const buys = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
  const sells = holdings.filter((h) => h.type === 'sell');

  // 매수+매도 모두에서 USD 거래일 날짜 수집
  const usdTransactions = holdings.filter((h) => h.currency === 'USD');
  const hasUsd = usdTransactions.length > 0;
  const uniqueDates = [...new Set(usdTransactions.map((h) => h.purchaseDate))];

  const { data: fxNow, isLoading: fxNowLoading, isError: fxNowError } = useQuery({
    queryKey: ['fx', 'now'] as const,
    queryFn: fetchCurrentExchangeRate,
    staleTime: 60_000,
    enabled: hasUsd,
  });

  const historicalResults = useQueries({
    queries: uniqueDates.map((date) => ({
      queryKey: ['fx', date] as const,
      queryFn: () => fetchHistoricalExchangeRate(date),
      staleTime: Infinity,
      enabled: hasUsd,
    })),
  });

  if (holdings.length === 0) return empty;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) return { ...empty, isLoading, isError };

  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalCurrentValue = 0;
  let totalSellProceeds = 0;

  for (const h of buys) {
    if (h.currency === 'KRW') {
      totalCost += h.shares * h.pricePerShare;
      totalCurrentValue += h.shares * currentPrice;
    } else {
      const fxAtBuy = fxByDate[h.purchaseDate];
      if (fxAtBuy == null || fxNow == null) continue;
      totalCost += h.shares * h.pricePerShare * fxAtBuy;
      totalCurrentValue += h.shares * currentPrice * fxNow;
    }
  }

  for (const h of sells) {
    if (h.currency === 'KRW') {
      totalCurrentValue -= h.shares * currentPrice;
      totalSellProceeds += h.shares * h.pricePerShare;
    } else {
      const fxAtSell = fxByDate[h.purchaseDate];
      if (fxAtSell == null || fxNow == null) continue;
      totalCurrentValue -= h.shares * currentPrice * fxNow;
      totalSellProceeds += h.shares * h.pricePerShare * fxAtSell;
    }
  }

  const totalValue = totalCurrentValue + totalSellProceeds;
  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // 매도 있으면 개별 row PnL 숨김 (avg cost 방식과 혼용 시 혼란 방지)
  const perHolding: { id: string; pnl: number }[] = [];
  if (sells.length === 0) {
    for (const h of buys) {
      if (h.currency === 'KRW') {
        perHolding.push({ id: h.id, pnl: h.shares * (currentPrice - h.pricePerShare) });
      } else {
        const fxAtBuy = fxByDate[h.purchaseDate];
        if (fxAtBuy == null || fxNow == null) continue;
        perHolding.push({
          id: h.id,
          pnl: h.shares * currentPrice * fxNow - h.shares * h.pricePerShare * fxAtBuy,
        });
      }
    }
  }

  return { totalPnL, pnlPercent, perHolding, isLoading: false, isError: false };
}
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/hooks/useHoldingPnL.test.ts --watchAll=false
```

Expected: PASS (4 tests)

- [ ] **Step 6: 커밋**

```bash
git add src/types/index.ts src/hooks/useHoldingPnL.ts __tests__/hooks/useHoldingPnL.test.ts
git commit -m "feat: add sell type to Holding and update useHoldingPnL for sell transactions"
```

---

## Task 2: usePortfolioSummary 업데이트

**Files:**
- Modify: `src/hooks/usePortfolioSummary.ts`
- Modify: `__tests__/hooks/usePortfolioSummary.test.ts`

- [ ] **Step 1: 테스트 추가 (failing)**

기존 `__tests__/hooks/usePortfolioSummary.test.ts` 파일에 아래 테스트를 추가한다.

```typescript
// 기존 두 테스트 아래에 추가
it('KRW 매도 있으면 totalPnL에 실현 손익 반영', () => {
  (useStocksStore as jest.Mock).mockReturnValue({
    stocks: [{ ticker: 'TEST', name: '테스트' }],
  });
  (useHoldingsStore as jest.Mock).mockReturnValue({
    getHoldings: () => [
      { id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100, purchaseDate: '2024-01-01', currency: 'KRW', type: 'buy' },
      { id: '2', ticker: 'TEST', shares: 3, pricePerShare: 150, purchaseDate: '2024-06-01', currency: 'KRW', type: 'sell' },
    ],
  });
  const { result } = renderHook(() => usePortfolioSummary());
  // totalCost = 1000, totalCurrentValue = 7 × currentPrice(0) = 0, sellProceeds = 450
  // totalPnL = (0 + 450) - 1000 = -550
  expect(result.current).not.toBeNull();
  expect(result.current!.totalPnL).toBe(-550);
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm test __tests__/hooks/usePortfolioSummary.test.ts --watchAll=false
```

Expected: FAIL — 새 테스트만 실패 (기존 2개는 통과)

- [ ] **Step 3: `src/hooks/usePortfolioSummary.ts` 수정**

```typescript
// src/hooks/usePortfolioSummary.ts
import { useQuery, useQueries, useQueryClient } from '@tanstack/react-query';
import { useStocksStore } from '../stores/stocksStore';
import { useHoldingsStore } from '../stores/holdingsStore';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';
import { StockQuote } from '../types';

const COLORS = ['#5b9bd5', '#c8caff', '#ff6b6b', '#ffd93d', '#6bcfb5', '#f4a261'];

export interface PortfolioSegment {
  ticker: string;
  name: string;
  color: string;
  weight: number;
}

export interface PortfolioSummary {
  totalPnL: number;
  pnlPercent: number;
  isLoading: boolean;
  isError: boolean;
  segments: PortfolioSegment[];
}

export function usePortfolioSummary(): PortfolioSummary | null {
  const { stocks } = useStocksStore();
  const { getHoldings } = useHoldingsStore();
  const queryClient = useQueryClient();

  const allHoldings = stocks.flatMap((s) => getHoldings(s.ticker));
  // 매수+매도 모두에서 USD 날짜 수집
  const usdTransactions = allHoldings.filter((h) => h.currency === 'USD');
  const hasUsd = usdTransactions.length > 0;
  const uniqueDates = [...new Set(usdTransactions.map((h) => h.purchaseDate))];

  const { data: fxNow, isLoading: fxNowLoading, isError: fxNowError } = useQuery({
    queryKey: ['fx', 'now'] as const,
    queryFn: fetchCurrentExchangeRate,
    staleTime: 60_000,
    enabled: hasUsd,
  });

  const historicalResults = useQueries({
    queries: uniqueDates.map((date) => ({
      queryKey: ['fx', date] as const,
      queryFn: () => fetchHistoricalExchangeRate(date),
      staleTime: Infinity,
      enabled: hasUsd,
    })),
  });

  if (allHoldings.length === 0) return null;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) {
    return { totalPnL: 0, pnlPercent: 0, isLoading, isError, segments: [] };
  }

  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalPnLValue = 0;    // PnL용: net currentValue + sellProceeds
  let totalCurrentValue = 0; // 비중 바용: net current position만

  const rawSegments = stocks.map((stock, idx) => {
    const holdings = getHoldings(stock.ticker);
    const quote = queryClient.getQueryData<StockQuote>(['quote', stock.ticker]);
    const currentPrice = quote?.currentPrice ?? 0;

    const buys = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
    const sells = holdings.filter((h) => h.type === 'sell');

    let stockCost = 0;
    let stockCurrentValue = 0;
    let stockSellProceeds = 0;

    for (const h of buys) {
      if (h.currency === 'KRW') {
        stockCost += h.shares * h.pricePerShare;
        stockCurrentValue += h.shares * currentPrice;
      } else {
        const fx = fxByDate[h.purchaseDate];
        if (fx == null || fxNow == null) continue;
        stockCost += h.shares * h.pricePerShare * fx;
        stockCurrentValue += h.shares * currentPrice * fxNow;
      }
    }

    for (const h of sells) {
      if (h.currency === 'KRW') {
        stockCurrentValue -= h.shares * currentPrice;
        stockSellProceeds += h.shares * h.pricePerShare;
      } else {
        const fx = fxByDate[h.purchaseDate];
        if (fx == null || fxNow == null) continue;
        stockCurrentValue -= h.shares * currentPrice * fxNow;
        stockSellProceeds += h.shares * h.pricePerShare * fx;
      }
    }

    totalCost += stockCost;
    totalPnLValue += stockCurrentValue + stockSellProceeds;
    totalCurrentValue += stockCurrentValue;

    return { ticker: stock.ticker, name: stock.name, value: stockCurrentValue, color: COLORS[idx % COLORS.length] };
  }).filter((s) => s.value > 0);

  const totalPnL = totalPnLValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const segments: PortfolioSegment[] = rawSegments.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    color: s.color,
    weight: totalCurrentValue > 0 ? s.value / totalCurrentValue : 0,
  }));

  return { totalPnL, pnlPercent, isLoading: false, isError: false, segments };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/hooks/usePortfolioSummary.test.ts --watchAll=false
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/usePortfolioSummary.ts __tests__/hooks/usePortfolioSummary.test.ts
git commit -m "feat: update usePortfolioSummary to account for sell transactions"
```

---

## Task 3: 상세 화면 UI 업데이트

**Files:**
- Modify: `app/stock/[ticker].tsx`

현재 파일: `app/stock/[ticker].tsx` (368줄)

추가할 내용:
1. 매도 모달 state (6개 변수)
2. `buyHoldings`, `sellHoldings`, `netShares` computed 값
3. `handleSellDateBlur`, `resetSellModal`, `handleAddSellHolding` 함수
4. `handleRemoveHolding`에 type 파라미터 추가
5. UI: 매수/매도 목록 분리, 버튼 2개, 매도 모달
6. StyleSheet에 스타일 2개 추가

- [ ] **Step 1: state 및 computed 추가**

`app/stock/[ticker].tsx`의 기존 state 선언 블록 아래에 추가:

```typescript
  // 매도 모달 state
  const [sellModalVisible, setSellModalVisible] = useState(false);
  const [sellInputDate, setSellInputDate] = useState('');
  const [sellInputShares, setSellInputShares] = useState('');
  const [sellFetchedPrice, setSellFetchedPrice] = useState<number | null>(null);
  const [sellPriceLoading, setSellPriceLoading] = useState(false);
  const [sellPriceError, setSellPriceError] = useState<string | null>(null);
```

기존 `const holdings = getHoldings(ticker);` 아래에 추가:

```typescript
  const buyHoldings = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
  const sellHoldings = holdings.filter((h) => h.type === 'sell');
  const netShares = buyHoldings.reduce((s, h) => s + h.shares, 0)
                  - sellHoldings.reduce((s, h) => s + h.shares, 0);
```

- [ ] **Step 2: 함수 추가**

기존 `handleAddHolding` 함수 아래에 아래 함수 3개를 추가한다.

```typescript
  const handleSellDateBlur = useCallback(async () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(sellInputDate)) return;
    const parsedDate = new Date(sellInputDate);
    if (isNaN(parsedDate.getTime()) || parsedDate > new Date()) return;

    setSellPriceLoading(true);
    setSellPriceError(null);
    setSellFetchedPrice(null);
    try {
      const price = await fetchHistoricalStockPrice(ticker, sellInputDate);
      setSellFetchedPrice(price);
    } catch {
      setSellPriceError('가격 조회 실패');
    } finally {
      setSellPriceLoading(false);
    }
  }, [sellInputDate, ticker]);

  const resetSellModal = () => {
    setSellInputDate('');
    setSellInputShares('');
    setSellFetchedPrice(null);
    setSellPriceError(null);
    setSellPriceLoading(false);
  };

  const handleAddSellHolding = () => {
    const shares = parseInt(sellInputShares, 10);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(sellInputDate)) {
      Alert.alert('오류', '날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    const parsedDate = new Date(sellInputDate);
    if (isNaN(parsedDate.getTime())) {
      Alert.alert('오류', '유효한 날짜를 입력해주세요.');
      return;
    }
    if (parsedDate > new Date()) {
      Alert.alert('오류', '미래 날짜는 입력할 수 없습니다.');
      return;
    }
    if (!Number.isInteger(shares) || shares < 1) {
      Alert.alert('오류', '주수는 1 이상의 정수로 입력해주세요.');
      return;
    }
    if (shares > netShares) {
      Alert.alert('오류', `매도 수량(${shares}주)이 보유 수량(${netShares}주)을 초과합니다.`);
      return;
    }
    if (sellFetchedPrice == null) {
      Alert.alert('오류', '매도일 가격을 조회 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const holding: Holding = {
      id: generateId(),
      ticker,
      shares,
      pricePerShare: sellFetchedPrice,
      purchaseDate: sellInputDate,
      currency: isKoreanStock(ticker) ? 'KRW' : 'USD',
      type: 'sell',
    };
    addHolding(holding);
    setSellModalVisible(false);
    resetSellModal();
  };
```

- [ ] **Step 3: handleRemoveHolding에 type 파라미터 추가**

기존:
```typescript
  const handleRemoveHolding = (id: string, date: string) => {
    Alert.alert(
      '매수 내역 삭제',
      `${date} 매수 내역을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => removeHolding(ticker, id) },
      ]
    );
  };
```

교체:
```typescript
  const handleRemoveHolding = (id: string, date: string, type: 'buy' | 'sell' = 'buy') => {
    const label = type === 'sell' ? '매도' : '매수';
    Alert.alert(
      `${label} 내역 삭제`,
      `${date} ${label} 내역을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => removeHolding(ticker, id) },
      ]
    );
  };
```

- [ ] **Step 4: holdingsSection UI 교체**

기존 `<View style={styles.holdingsSection}>` 전체를 아래로 교체한다.

```tsx
        <View style={styles.holdingsSection}>
          <Text style={styles.holdingsTitle}>내 보유 현황</Text>

          {holdings.length > 0 && (
            <View style={styles.pnlSummary}>
              <Text style={styles.netShares}>
                순 보유량: {netShares}주
                {netShares === 0 && '  (전량 매도)'}
              </Text>
              {pnlLoading ? (
                <ActivityIndicator color="#5b9bd5" size="small" style={{ marginTop: 4 }} />
              ) : pnlError ? (
                <Text style={styles.pnlError}>환율 조회 실패 — 손익 계산 불가</Text>
              ) : (
                <Text style={[styles.pnlTotal, { color: pnlColor }]}>
                  총 손익 {totalPnL >= 0 ? '+' : ''}₩{Math.round(totalPnL).toLocaleString('ko-KR')}
                  {'  '}({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                </Text>
              )}
            </View>
          )}

          {/* 매수 내역 */}
          {buyHoldings.length > 0 && (
            <Text style={styles.subSectionLabel}>매수 내역</Text>
          )}
          {buyHoldings.map((h) => {
            const pnlEntry = perHolding.find((p) => p.id === h.id);
            const pnl = pnlEntry?.pnl;
            return (
              <TouchableOpacity
                key={h.id}
                style={styles.holdingRow}
                onLongPress={() => handleRemoveHolding(h.id, h.purchaseDate, 'buy')}
                activeOpacity={0.8}
              >
                <View>
                  <Text style={styles.holdingDate}>{h.purchaseDate}</Text>
                  <Text style={styles.holdingMeta}>
                    {h.shares}주 · {priceSymbol}{h.pricePerShare.toLocaleString()}
                  </Text>
                </View>
                {pnl != null && !pnlLoading && !pnlError ? (
                  <Text style={[styles.holdingPnl, { color: pnl >= 0 ? '#00e676' : '#FF1744' }]}>
                    {pnl >= 0 ? '+' : ''}₩{Math.round(pnl).toLocaleString('ko-KR')}
                  </Text>
                ) : (
                  <Text style={styles.holdingPnlPlaceholder}>—</Text>
                )}
              </TouchableOpacity>
            );
          })}

          {/* 매도 내역 */}
          {sellHoldings.length > 0 && (
            <>
              <Text style={[styles.subSectionLabel, { marginTop: 12 }]}>매도 내역</Text>
              {sellHoldings.map((h) => (
                <TouchableOpacity
                  key={h.id}
                  style={styles.holdingRow}
                  onLongPress={() => handleRemoveHolding(h.id, h.purchaseDate, 'sell')}
                  activeOpacity={0.8}
                >
                  <View>
                    <Text style={styles.holdingDate}>{h.purchaseDate}</Text>
                    <Text style={styles.holdingMeta}>
                      {h.shares}주 · {priceSymbol}{h.pricePerShare.toLocaleString()}
                    </Text>
                  </View>
                  <Text style={styles.holdingPnlPlaceholder}>
                    {currency === 'KRW'
                      ? `₩${Math.round(h.shares * h.pricePerShare).toLocaleString('ko-KR')}`
                      : `$${(h.shares * h.pricePerShare).toLocaleString()}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}

          {/* 버튼 영역 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Ionicons name="add-circle-outline" size={18} color="#5b9bd5" />
              <Text style={styles.addButtonText}>매수 내역 추가</Text>
            </TouchableOpacity>
            {netShares > 0 && (
              <TouchableOpacity style={styles.addButton} onPress={() => setSellModalVisible(true)}>
                <Ionicons name="remove-circle-outline" size={18} color="#FF1744" />
                <Text style={[styles.addButtonText, { color: '#FF1744' }]}>매도 내역 추가</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
```

- [ ] **Step 5: 매도 모달 추가**

기존 `</Modal>` (매수 모달 닫는 태그) 바로 아래에 추가:

```tsx
      <Modal visible={sellModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>매도 내역 추가</Text>

            <Text style={styles.inputLabel}>매도일 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={sellInputDate}
              onChangeText={setSellInputDate}
              onBlur={handleSellDateBlur}
              placeholder="예: 2024-06-20"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />
            {sellPriceLoading && (
              <ActivityIndicator color="#5b9bd5" size="small" style={{ marginTop: 8 }} />
            )}
            {!sellPriceLoading && sellFetchedPrice != null && (
              <Text style={styles.fetchedPrice}>
                당일 종가: {priceSymbol}{sellFetchedPrice.toLocaleString()}
              </Text>
            )}
            {!sellPriceLoading && sellPriceError != null && (
              <Text style={styles.fetchedPriceError}>{sellPriceError}</Text>
            )}

            <Text style={styles.inputLabel}>주수 (보유: {netShares}주)</Text>
            <TextInput
              style={styles.input}
              value={sellInputShares}
              onChangeText={setSellInputShares}
              placeholder="예: 3"
              placeholderTextColor="#555"
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setSellModalVisible(false);
                  resetSellModal();
                }}
              >
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: '#FF1744' }]}
                onPress={handleAddSellHolding}
              >
                <Text style={styles.modalBtnConfirmText}>매도 추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
```

- [ ] **Step 6: StyleSheet에 스타일 추가**

기존 `StyleSheet.create({...})` 안에 아래 항목을 추가한다:

```typescript
  netShares: { color: '#888', fontSize: 13, marginBottom: 4 },
  subSectionLabel: { color: '#555', fontSize: 11, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
  actionButtons: { gap: 8, marginTop: 12 },
```

기존 `addButton` 스타일에서 `marginTop: 12`를 제거한다 (이제 `actionButtons`가 gap 처리):

```typescript
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#2d3150', borderStyle: 'dashed',
  },
```

- [ ] **Step 7: 전체 테스트 통과 확인**

```bash
pnpm test --watchAll=false
```

Expected: 전체 PASS (기존 32개 + 신규 5개 = 37개)

- [ ] **Step 8: 커밋**

```bash
git add app/stock/[ticker].tsx
git commit -m "feat: add sell transaction UI to stock detail screen"
```
