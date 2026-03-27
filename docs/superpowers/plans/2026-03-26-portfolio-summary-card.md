# Portfolio Summary Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 화면 상단에 전 종목 보유 손익 합계와 종목별 비중 바를 보여주는 요약 카드를 추가한다.

**Architecture:** `usePortfolioSummary` hook이 전 종목 holdings를 한 번에 집계하고 환율 변환을 처리한다. `PortfolioSummaryCard` 컴포넌트가 이 hook을 사용해 렌더링하며, `app/(tabs)/index.tsx` 헤더 아래에 1줄로 추가된다. React Query `['fx', 'now']` 캐시 키를 `useHoldingPnL`과 공유하므로 환율 API 중복 호출이 없다.

**Tech Stack:** React Native, TypeScript, Zustand (`useStocksStore`, `useHoldingsStore`), TanStack React Query v5 (`useQuery`, `useQueries`, `useQueryClient`), jest-expo + @testing-library/react-native

---

## File Map

| 파일 | 작업 |
|------|------|
| `src/hooks/usePortfolioSummary.ts` | 신규 — 전 종목 손익 집계 hook |
| `src/components/PortfolioSummaryCard.tsx` | 신규 — 요약 카드 UI 컴포넌트 |
| `app/(tabs)/index.tsx` | 수정 — import 1줄 + `<PortfolioSummaryCard />` 1줄 추가 |
| `__tests__/hooks/usePortfolioSummary.test.ts` | 신규 — hook 단위 테스트 |
| `__tests__/components/PortfolioSummaryCard.test.tsx` | 신규 — 컴포넌트 렌더 테스트 |

---

## Task 1: usePortfolioSummary hook

**Files:**
- Create: `src/hooks/usePortfolioSummary.ts`
- Test: `__tests__/hooks/usePortfolioSummary.test.ts`

### 반환 타입

```typescript
export interface PortfolioSegment {
  ticker: string;
  name: string;
  color: string;
  weight: number; // 0~1, 현재 평가금액 기준 비중
}

export interface PortfolioSummary {
  totalPnL: number;        // 원화 기준 총 손익
  pnlPercent: number;      // 수익률 (%)
  isLoading: boolean;
  isError: boolean;
  segments: PortfolioSegment[]; // 보유 내역 있는 종목만, 평가금액 > 0인 경우만
}
// 반환 null = 보유 내역 없음 → 카드 미표시
```

- [ ] **Step 1: 테스트 파일 생성 (failing)**

```typescript
// __tests__/hooks/usePortfolioSummary.test.ts
import { renderHook } from '@testing-library/react-native';
import { usePortfolioSummary } from '../../src/hooks/usePortfolioSummary';
import { useStocksStore } from '../../src/stores/stocksStore';
import { useHoldingsStore } from '../../src/stores/holdingsStore';

jest.mock('../../src/stores/stocksStore');
jest.mock('../../src/stores/holdingsStore');
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, isError: false }),
  useQueries: () => [],
  useQueryClient: () => ({ getQueryData: () => undefined }),
}));

it('보유 내역 없으면 null 반환', () => {
  (useStocksStore as jest.Mock).mockReturnValue({ stocks: [] });
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  const { result } = renderHook(() => usePortfolioSummary());
  expect(result.current).toBeNull();
});

it('모든 종목 holdings가 빈 배열이면 null 반환', () => {
  (useStocksStore as jest.Mock).mockReturnValue({
    stocks: [{ ticker: 'NVDA', name: 'NVIDIA' }],
  });
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  const { result } = renderHook(() => usePortfolioSummary());
  expect(result.current).toBeNull();
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
cd /Users/hare/vibecoding_project/02_stock_tracker/stock-watcher
pnpm test __tests__/hooks/usePortfolioSummary.test.ts --watchAll=false
```

Expected: FAIL — `Cannot find module '../../src/hooks/usePortfolioSummary'`

- [ ] **Step 3: hook 구현**

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
  const usdHoldings = allHoldings.filter((h) => h.currency === 'USD');
  const hasUsd = usdHoldings.length > 0;
  const uniqueDates = [...new Set(usdHoldings.map((h) => h.purchaseDate))];

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
  let totalValue = 0;

  const rawSegments = stocks.map((stock, idx) => {
    const holdings = getHoldings(stock.ticker);
    const quote = queryClient.getQueryData<StockQuote>(['quote', stock.ticker]);
    const currentPrice = quote?.currentPrice ?? 0;

    let stockCost = 0;
    let stockValue = 0;

    for (const h of holdings) {
      if (h.currency === 'KRW') {
        stockCost += h.shares * h.pricePerShare;
        stockValue += h.shares * currentPrice;
      } else {
        const fxAtPurchase = fxByDate[h.purchaseDate];
        if (fxAtPurchase == null || fxNow == null) continue;
        stockCost += h.shares * h.pricePerShare * fxAtPurchase;
        stockValue += h.shares * currentPrice * fxNow;
      }
    }

    totalCost += stockCost;
    totalValue += stockValue;

    return { ticker: stock.ticker, name: stock.name, value: stockValue, color: COLORS[idx % COLORS.length] };
  }).filter((s) => s.value > 0);

  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const segments: PortfolioSegment[] = rawSegments.map((s) => ({
    ticker: s.ticker,
    name: s.name,
    color: s.color,
    weight: totalValue > 0 ? s.value / totalValue : 0,
  }));

  return { totalPnL, pnlPercent, isLoading: false, isError: false, segments };
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/hooks/usePortfolioSummary.test.ts --watchAll=false
```

Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/hooks/usePortfolioSummary.ts __tests__/hooks/usePortfolioSummary.test.ts
git commit -m "feat: add usePortfolioSummary hook"
```

---

## Task 2: PortfolioSummaryCard 컴포넌트

**Files:**
- Create: `src/components/PortfolioSummaryCard.tsx`
- Test: `__tests__/components/PortfolioSummaryCard.test.tsx`

- [ ] **Step 1: 테스트 파일 생성 (failing)**

```typescript
// __tests__/components/PortfolioSummaryCard.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { PortfolioSummaryCard } from '../../src/components/PortfolioSummaryCard';
import * as summaryHook from '../../src/hooks/usePortfolioSummary';

jest.mock('../../src/hooks/usePortfolioSummary');

it('hook이 null 반환하면 아무것도 렌더링 안 됨', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue(null);
  const { toJSON } = render(<PortfolioSummaryCard />);
  expect(toJSON()).toBeNull();
});

it('로딩 중이면 ActivityIndicator 표시', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue({
    totalPnL: 0, pnlPercent: 0, isLoading: true, isError: false, segments: [],
  });
  const { getByTestId } = render(<PortfolioSummaryCard />);
  expect(getByTestId('portfolio-loading')).toBeTruthy();
});

it('양수 손익은 초록색으로 표시', () => {
  jest.spyOn(summaryHook, 'usePortfolioSummary').mockReturnValue({
    totalPnL: 1_000_000,
    pnlPercent: 8.4,
    isLoading: false,
    isError: false,
    segments: [{ ticker: 'NVDA', name: 'NVIDIA', color: '#5b9bd5', weight: 1 }],
  });
  const { getByTestId } = render(<PortfolioSummaryCard />);
  const pnlText = getByTestId('portfolio-pnl');
  expect(pnlText.props.style).toMatchObject({ color: '#00e676' });
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm test __tests__/components/PortfolioSummaryCard.test.tsx --watchAll=false
```

Expected: FAIL — `Cannot find module '../../src/components/PortfolioSummaryCard'`

- [ ] **Step 3: 컴포넌트 구현**

```typescript
// src/components/PortfolioSummaryCard.tsx
import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { usePortfolioSummary } from '../hooks/usePortfolioSummary';

export function PortfolioSummaryCard() {
  const summary = usePortfolioSummary();

  if (summary === null) return null;

  const { totalPnL, pnlPercent, isLoading, isError, segments } = summary;
  const pnlColor = totalPnL >= 0 ? '#00e676' : '#FF1744';
  const sign = totalPnL >= 0 ? '+' : '';

  return (
    <View style={styles.card}>
      <Text style={styles.label}>포트폴리오 총 손익</Text>

      {isLoading ? (
        <ActivityIndicator testID="portfolio-loading" color="#5b9bd5" style={{ marginVertical: 8 }} />
      ) : isError ? (
        <Text style={styles.error}>환율 조회 실패</Text>
      ) : (
        <>
          <Text testID="portfolio-pnl" style={[styles.pnl, { color: pnlColor }]}>
            {sign}₩{Math.round(totalPnL).toLocaleString('ko-KR')}
          </Text>
          <Text style={[styles.percent, { color: pnlColor }]}>
            {sign}{pnlPercent.toFixed(2)}%
          </Text>
        </>
      )}

      {segments.length > 0 && (
        <>
          <View style={styles.bar}>
            {segments.map((s) => (
              <View
                key={s.ticker}
                style={[styles.barSegment, { flex: s.weight, backgroundColor: s.color }]}
              />
            ))}
          </View>
          <View style={styles.legend}>
            {segments.map((s) => (
              <View key={s.ticker} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: s.color }]} />
                <Text style={styles.legendText}>{s.name}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1c1f33',
    borderRadius: 14,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2d3150',
  },
  label: { color: '#888', fontSize: 12, marginBottom: 4 },
  pnl: { fontSize: 22, fontWeight: '800' },
  percent: { fontSize: 13, marginTop: 2, marginBottom: 10 },
  error: { color: '#FF1744', fontSize: 13, marginVertical: 8 },
  bar: {
    flexDirection: 'row',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
    gap: 1,
  },
  barSegment: { borderRadius: 3 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { color: '#888', fontSize: 11 },
});
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/components/PortfolioSummaryCard.test.tsx --watchAll=false
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/PortfolioSummaryCard.tsx __tests__/components/PortfolioSummaryCard.test.tsx
git commit -m "feat: add PortfolioSummaryCard component"
```

---

## Task 3: 홈 화면에 카드 연결

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 1: import 추가 및 카드 삽입**

`app/(tabs)/index.tsx` 상단 import 목록에 추가:
```typescript
import { PortfolioSummaryCard } from '../../src/components/PortfolioSummaryCard';
```

`HomeScreen`의 헤더 `<View>` 와 `<FlatList>` 사이에 추가:
```typescript
      </View>

      <PortfolioSummaryCard />

      <FlatList
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
pnpm test --watchAll=false
```

Expected: 전체 PASS

- [ ] **Step 3: 시뮬레이터에서 동작 확인**

보유 내역이 있는 종목이 있으면 헤더 아래에 총 손익 카드가 표시된다.
보유 내역이 없으면 카드가 보이지 않는다.

- [ ] **Step 4: 커밋**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: show portfolio summary card on home screen"
```
