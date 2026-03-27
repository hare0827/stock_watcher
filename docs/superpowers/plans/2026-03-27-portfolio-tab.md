# 포트폴리오 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 탭바에 포트폴리오 전용 탭을 추가해 총 손익, 도넛 차트(종목별 비중), 종목별 손익 리스트를 보여준다.

**Architecture:** `usePortfolioSummary` 훅(기존)이 총 손익과 segments를 반환한다. `DonutChart`는 react-native-svg로 세그먼트별 원형 차트를 그린다. `StockPnLRow`는 종목 1개의 손익 행을 담당하며 내부에서 `useStockPrice` + `useHoldingPnL`을 호출한다 (hooks-of-hooks 분리). `portfolio.tsx`가 이 모두를 조합한다.

**Tech Stack:** React Native, Expo Router, react-native-svg, Zustand, TanStack React Query v5, jest-expo + @testing-library/react-native

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `src/components/DonutChart.tsx` | 신규 — SVG 도넛 차트 |
| `src/components/StockPnLRow.tsx` | 신규 — 종목별 손익 행 |
| `app/(tabs)/portfolio.tsx` | 신규 — 포트폴리오 탭 화면 |
| `app/(tabs)/_layout.tsx` | 수정 — 탭 추가 |
| `__tests__/components/DonutChart.test.tsx` | 신규 |
| `__tests__/components/StockPnLRow.test.tsx` | 신규 |

---

## Task 1: DonutChart 컴포넌트

**Files:**
- Create: `src/components/DonutChart.tsx`
- Test: `__tests__/components/DonutChart.test.tsx`

### DonutChart 수학

- 원 반지름: `r = (size - strokeWidth) / 2`
- 원주: `C = 2 * Math.PI * r`
- 세그먼트 간 gap: `gapArc = 2` (픽셀)
- 실제 사용 가능한 원주: `availableC = C - gapArc * segments.length`
- 각 세그먼트: `dashLen = seg.weight * availableC`
- offset (SVG strokeDashoffset): `C - 누적(이전 세그먼트 dashLen + gapArc)`
- `G rotation="-90"` 으로 12시 방향 시작

---

- [ ] **Step 1: 테스트 파일 생성 (failing)**

```typescript
// __tests__/components/DonutChart.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { DonutChart } from '../../src/components/DonutChart';

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: any) => <View testID="svg" {...props}>{children}</View>,
    Svg: ({ children, ...props }: any) => <View testID="svg" {...props}>{children}</View>,
    Circle: (props: any) => <View testID="circle" {...props} />,
    G: ({ children, ...props }: any) => <View {...props}>{children}</View>,
  };
});

it('segments 없으면 null 렌더링', () => {
  const { toJSON } = render(<DonutChart segments={[]} />);
  expect(toJSON()).toBeNull();
});

it('segments 있으면 Circle 개수만큼 렌더링', () => {
  const { getAllByTestId } = render(
    <DonutChart
      segments={[
        { color: '#5b9bd5', weight: 0.6 },
        { color: '#ff6b6b', weight: 0.4 },
      ]}
    />
  );
  expect(getAllByTestId('circle')).toHaveLength(2);
});

it('centerLabel 텍스트 표시', () => {
  const { getByText } = render(
    <DonutChart segments={[{ color: '#5b9bd5', weight: 1 }]} centerLabel="2종목" />
  );
  expect(getByText('2종목')).toBeTruthy();
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm test __tests__/components/DonutChart.test.tsx --watchAll=false
```

Expected: FAIL — `Cannot find module '../../src/components/DonutChart'`

- [ ] **Step 3: DonutChart 구현**

```typescript
// src/components/DonutChart.tsx
import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

interface DonutChartProps {
  segments: { color: string; weight: number }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
}

export function DonutChart({ segments, size = 120, strokeWidth = 22, centerLabel }: DonutChartProps) {
  if (segments.length === 0) return null;

  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const C = 2 * Math.PI * r;
  const gapArc = 2;
  const availableC = C - gapArc * segments.length;

  let accOffset = 0;
  const arcs = segments.map((seg) => {
    const dashLen = seg.weight * availableC;
    const offset = C - accOffset;
    accOffset += dashLen + gapArc;
    return { dashLen, offset, color: seg.color };
  });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <G rotation="-90" origin={`${cx}, ${cy}`}>
          {arcs.map((arc, i) => (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${arc.dashLen} ${C}`}
              strokeDashoffset={arc.offset}
              strokeLinecap="butt"
            />
          ))}
        </G>
      </Svg>
      {centerLabel != null && (
        <Text style={{ color: '#888', fontSize: 11, textAlign: 'center' }}>{centerLabel}</Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/components/DonutChart.test.tsx --watchAll=false
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/DonutChart.tsx __tests__/components/DonutChart.test.tsx
git commit -m "feat: add DonutChart component"
```

---

## Task 2: StockPnLRow 컴포넌트

**Files:**
- Create: `src/components/StockPnLRow.tsx`
- Test: `__tests__/components/StockPnLRow.test.tsx`

`StockPnLRow`는 종목 1개의 손익 행을 렌더링한다. 내부에서 `useStockPrice`와 `useHoldingPnL`을 직접 호출하므로, 상위 컴포넌트에서 hooks-of-hooks 없이 리스트 렌더링이 가능하다.

---

- [ ] **Step 1: 테스트 파일 생성 (failing)**

```typescript
// __tests__/components/StockPnLRow.test.tsx
import React from 'react';
import { render } from '@testing-library/react-native';
import { StockPnLRow } from '../../src/components/StockPnLRow';
import { useHoldingsStore } from '../../src/stores/holdingsStore';
import { useStockPrice } from '../../src/hooks/useStockPrice';
import { useHoldingPnL } from '../../src/hooks/useHoldingPnL';

jest.mock('../../src/stores/holdingsStore');
jest.mock('../../src/hooks/useStockPrice');
jest.mock('../../src/hooks/useHoldingPnL');

const mockStock = { ticker: 'TEST', name: '테스트' };
const mockHolding = {
  id: '1', ticker: 'TEST', shares: 10, pricePerShare: 100,
  purchaseDate: '2024-01-01', currency: 'KRW' as const, type: 'buy' as const,
};

it('양수 손익은 초록색으로 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [mockHolding] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: { currentPrice: 150 } });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: 500, pnlPercent: 5.0, isLoading: false, isError: false, perHolding: [],
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  const el = getByText('+₩500');
  expect(el.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: '#00e676' })])
  );
});

it('음수 손익은 빨간색으로 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [mockHolding] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: { currentPrice: 80 } });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: -200, pnlPercent: -2.0, isLoading: false, isError: false, perHolding: [],
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  const el = getByText('-₩200');
  expect(el.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ color: '#FF1744' })])
  );
});

it('로딩 중이면 — 표시', () => {
  (useHoldingsStore as jest.Mock).mockReturnValue({ getHoldings: () => [] });
  (useStockPrice as jest.Mock).mockReturnValue({ data: undefined });
  (useHoldingPnL as jest.Mock).mockReturnValue({
    totalPnL: 0, pnlPercent: 0, isLoading: true, isError: false, perHolding: [],
  });

  const { getByText } = render(<StockPnLRow stock={mockStock} color="#5b9bd5" />);
  expect(getByText('—')).toBeTruthy();
});
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

```bash
pnpm test __tests__/components/StockPnLRow.test.tsx --watchAll=false
```

Expected: FAIL — `Cannot find module '../../src/components/StockPnLRow'`

- [ ] **Step 3: StockPnLRow 구현**

```typescript
// src/components/StockPnLRow.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useStockPrice } from '../hooks/useStockPrice';
import { useHoldingPnL } from '../hooks/useHoldingPnL';
import { useHoldingsStore } from '../stores/holdingsStore';
import { formatCurrency } from '../utils/format';
import { Stock } from '../types';

interface StockPnLRowProps {
  stock: Stock;
  color: string;
}

export function StockPnLRow({ stock, color }: StockPnLRowProps) {
  const { getHoldings } = useHoldingsStore();
  const holdings = getHoldings(stock.ticker);
  const { data: quote } = useStockPrice(stock.ticker);
  const currentPrice = quote?.currentPrice ?? 0;
  const { totalPnL, pnlPercent, isLoading } = useHoldingPnL(holdings, currentPrice);

  const buys = holdings.filter((h) => (h.type ?? 'buy') === 'buy');
  const sells = holdings.filter((h) => h.type === 'sell');
  const netShares = buys.reduce((s, h) => s + h.shares, 0)
                  - sells.reduce((s, h) => s + h.shares, 0);

  const pnlColor = totalPnL >= 0 ? '#00e676' : '#FF1744';
  const sign = totalPnL >= 0 ? '+' : '-';
  const priceStr = currentPrice > 0 ? formatCurrency(currentPrice, stock.ticker) : '—';

  return (
    <View style={styles.row}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <View>
          <Text style={styles.name}>{stock.name}</Text>
          <Text style={styles.meta}>
            {stock.ticker} · {netShares}주 · {priceStr}
          </Text>
        </View>
      </View>
      {isLoading ? (
        <Text style={styles.placeholder}>—</Text>
      ) : (
        <View style={styles.right}>
          <Text style={[styles.pnl, { color: pnlColor }]}>
            {sign}₩{Math.round(Math.abs(totalPnL)).toLocaleString('ko-KR')}
          </Text>
          <Text style={[styles.percent, { color: pnlColor }]}>
            {sign}{Math.abs(pnlPercent).toFixed(2)}%
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2d3150',
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 3, flexShrink: 0 },
  name: { color: '#c8caff', fontSize: 13, fontWeight: '700' },
  meta: { color: '#555', fontSize: 11, marginTop: 2 },
  right: { alignItems: 'flex-end' },
  pnl: { fontSize: 13, fontWeight: '700' },
  percent: { fontSize: 11, marginTop: 1 },
  placeholder: { color: '#555', fontSize: 13 },
});
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

```bash
pnpm test __tests__/components/StockPnLRow.test.tsx --watchAll=false
```

Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/components/StockPnLRow.tsx __tests__/components/StockPnLRow.test.tsx
git commit -m "feat: add StockPnLRow component"
```

---

## Task 3: 포트폴리오 탭 화면

**Files:**
- Create: `app/(tabs)/portfolio.tsx`

---

- [ ] **Step 1: portfolio.tsx 생성**

```typescript
// app/(tabs)/portfolio.tsx
import React from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStocksStore } from '../../src/stores/stocksStore';
import { useHoldingsStore } from '../../src/stores/holdingsStore';
import { usePortfolioSummary } from '../../src/hooks/usePortfolioSummary';
import { DonutChart } from '../../src/components/DonutChart';
import { StockPnLRow } from '../../src/components/StockPnLRow';

export default function PortfolioScreen() {
  const { stocks } = useStocksStore();
  const { getHoldings } = useHoldingsStore();
  const summary = usePortfolioSummary();

  const holdingStocks = stocks.filter((s) => getHoldings(s.ticker).length > 0);

  if (summary === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📊</Text>
          <Text style={styles.emptyTitle}>아직 보유 종목이 없어요</Text>
          <Text style={styles.emptyDesc}>종목 상세 화면에서 매수 내역을 추가해보세요</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { totalPnL, pnlPercent, isLoading, isError, segments } = summary;
  const pnlColor = totalPnL >= 0 ? '#00e676' : '#FF1744';
  const sign = totalPnL >= 0 ? '+' : '-';

  const colorMap = Object.fromEntries(segments.map((s) => [s.ticker, s.color]));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* 총 손익 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerLabel}>포트폴리오 총 손익</Text>
          {isLoading ? (
            <ActivityIndicator color="#5b9bd5" style={{ marginVertical: 8 }} />
          ) : isError ? (
            <Text style={styles.error}>환율 조회 실패</Text>
          ) : (
            <>
              <Text style={[styles.totalPnL, { color: pnlColor }]}>
                {sign}₩{Math.round(Math.abs(totalPnL)).toLocaleString('ko-KR')}
              </Text>
              <Text style={[styles.pnlPercent, { color: pnlColor }]}>
                {sign}{Math.abs(pnlPercent).toFixed(2)}%
              </Text>
            </>
          )}
        </View>

        {/* 도넛 차트 + 범례 */}
        {segments.length > 0 && (
          <View style={styles.chartSection}>
            <DonutChart
              segments={segments}
              size={140}
              strokeWidth={26}
              centerLabel={`${segments.length}종목`}
            />
            <View style={styles.legend}>
              {segments.map((s) => (
                <View key={s.ticker} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                  <Text style={styles.legendText}>{s.name}</Text>
                  <Text style={styles.legendWeight}>{(s.weight * 100).toFixed(0)}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 종목별 손익 리스트 */}
        <View style={styles.listSection}>
          <Text style={styles.listTitle}>종목별 손익</Text>
          {holdingStocks.map((stock) => (
            <StockPnLRow
              key={stock.ticker}
              stock={stock}
              color={colorMap[stock.ticker] ?? '#5b9bd5'}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  header: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: '#1c1f33',
  },
  headerLabel: { color: '#888', fontSize: 12, marginBottom: 6 },
  totalPnL: { fontSize: 32, fontWeight: '800' },
  pnlPercent: { fontSize: 15, marginTop: 4 },
  error: { color: '#FF1744', fontSize: 14, marginTop: 8 },
  chartSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 24, gap: 20,
    borderBottomWidth: 1, borderBottomColor: '#1c1f33',
  },
  legend: { flex: 1, gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 2 },
  legendText: { color: '#c8caff', fontSize: 12, flex: 1 },
  legendWeight: { color: '#555', fontSize: 11 },
  listSection: { paddingTop: 20 },
  listTitle: {
    color: '#888', fontSize: 11, fontWeight: '600',
    letterSpacing: 0.5, marginBottom: 4,
  },
  emptyContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 60, paddingTop: 80,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: '#c8caff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  emptyDesc: { color: '#555', fontSize: 13, textAlign: 'center' },
});
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
pnpm test --watchAll=false
```

Expected: 전체 PASS

- [ ] **Step 3: 커밋**

```bash
git add "app/(tabs)/portfolio.tsx"
git commit -m "feat: add portfolio tab screen"
```

---

## Task 4: 탭바 연결

**Files:**
- Modify: `app/(tabs)/_layout.tsx`

---

- [ ] **Step 1: 탭 추가**

`app/(tabs)/_layout.tsx`의 `index` 탭과 `settings` 탭 사이에 추가:

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { backgroundColor: '#1c1f33', borderTopColor: '#2d3150' },
        tabBarActiveTintColor: '#c8caff',
        tabBarInactiveTintColor: '#555',
        headerStyle: { backgroundColor: '#0e1117' },
        headerTintColor: '#ffffff',
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: '포트폴리오',
          tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 2: 전체 테스트 통과 확인**

```bash
pnpm test --watchAll=false
```

Expected: 전체 PASS

- [ ] **Step 3: 시뮬레이터 확인**

탭바에 "포트폴리오" 탭이 홈/설정 사이에 보인다.
매수 내역 있으면: 총 손익 헤더 + 도넛 차트 + 종목 리스트 표시.
매수 내역 없으면: "아직 보유 종목이 없어요" 빈 상태 표시.

- [ ] **Step 4: 커밋**

```bash
git add "app/(tabs)/_layout.tsx"
git commit -m "feat: add portfolio tab to tab bar"
```
