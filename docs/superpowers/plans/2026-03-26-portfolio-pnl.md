# 포트폴리오 손익 추적 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종목 상세 화면에 매수 내역 입력 및 원화 기준 손익 표시 기능 추가

**Architecture:** 기존 `alertStore`와 동일한 Zustand + AsyncStorage 패턴으로 `holdingsStore`를 신규 생성하고, Yahoo Finance `KRW=X` 티커로 현재/과거 환율을 조회해 USD 종목 손익을 원화로 환산한다. UI는 `app/stock/[ticker].tsx` 하단에 "내 보유 현황" 섹션과 추가 모달을 붙인다.

**Tech Stack:** React Native, Expo Router, Zustand, AsyncStorage, TanStack React Query, Yahoo Finance v8 API (기존 `fetchYahooChart` 재사용)

---

## 파일 맵

| 상태 | 파일 | 역할 |
|------|------|------|
| 수정 | `src/types/index.ts` | `Holding` 인터페이스 추가 |
| 신규 | `src/stores/holdingsStore.ts` | 매수 내역 Zustand 스토어 |
| 수정 | `app/_layout.tsx` | holdingsStore hydrate 연결 |
| 수정 | `src/api/yahoo.ts` | 현재/과거 환율 조회 함수 추가 |
| 신규 | `src/hooks/useHoldingPnL.ts` | 손익 계산 훅 |
| 수정 | `src/stores/stocksStore.ts` | removeStock 시 clearHoldings 호출 |
| 수정 | `app/stock/[ticker].tsx` | 보유 현황 섹션 + 추가 모달 |

---

## Task 1: Holding 타입 추가

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Holding 인터페이스를 `src/types/index.ts` 끝에 추가**

```typescript
export interface Holding {
  id: string;              // 고유 식별자 (Math.random 기반)
  ticker: string;
  shares: number;          // 양의 정수
  pricePerShare: number;   // USD 종목은 USD, KRW 종목은 KRW
  purchaseDate: string;    // 'YYYY-MM-DD'
  currency: 'KRW' | 'USD';
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/types/index.ts
git commit -m "feat: add Holding type for portfolio tracking"
```

---

## Task 2: holdingsStore 생성

**Files:**
- Create: `src/stores/holdingsStore.ts`

- [ ] **Step 1: `src/stores/holdingsStore.ts` 생성**

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Holding } from '../types';

const STORAGE_KEY = '@holdings';

interface HoldingsState {
  holdings: Record<string, Holding[]>; // ticker → Holding[]
  hydrated: boolean;
  hydrate: () => Promise<void>;
  addHolding: (holding: Holding) => void;
  removeHolding: (ticker: string, id: string) => void;
  clearHoldings: (ticker: string) => void;
  getHoldings: (ticker: string) => Holding[];
}

export const useHoldingsStore = create<HoldingsState>((set, get) => ({
  holdings: {},
  hydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const holdings = raw ? JSON.parse(raw) : {};
      set({ holdings, hydrated: true });
    } catch {
      set({ holdings: {}, hydrated: true });
    }
  },

  addHolding: (holding) => {
    const { holdings } = get();
    const existing = holdings[holding.ticker] ?? [];
    const next = { ...holdings, [holding.ticker]: [...existing, holding] };
    set({ holdings: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  removeHolding: (ticker, id) => {
    const { holdings } = get();
    const next = {
      ...holdings,
      [ticker]: (holdings[ticker] ?? []).filter((h) => h.id !== id),
    };
    set({ holdings: next });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  },

  clearHoldings: (ticker) => {
    const { [ticker]: _, ...rest } = get().holdings;
    set({ holdings: rest });
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
  },

  getHoldings: (ticker) => get().holdings[ticker] ?? [],
}));
```

- [ ] **Step 2: 커밋**

```bash
git add src/stores/holdingsStore.ts
git commit -m "feat: add holdingsStore for portfolio holdings"
```

---

## Task 3: holdingsStore hydrate 연결

**Files:**
- Modify: `app/_layout.tsx`

- [ ] **Step 1: `_layout.tsx`에 holdingsStore hydrate 추가**

`app/_layout.tsx`의 `HydrationGate` 컴포넌트를 아래와 같이 수정한다.

```typescript
// app/_layout.tsx
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStocksStore } from '../src/stores/stocksStore';
import { useAlertStore } from '../src/stores/alertStore';
import { useHoldingsStore } from '../src/stores/holdingsStore';

const queryClient = new QueryClient();

function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrate, hydrated } = useStocksStore();
  const { hydrateAlert } = useAlertStore();
  const { hydrate: hydrateHoldings } = useHoldingsStore();

  useEffect(() => {
    hydrate().then(() => {
      const latestStocks = useStocksStore.getState().stocks;
      latestStocks.forEach((s) => hydrateAlert(s.ticker));
    });
    hydrateHoldings();
  }, []);

  if (!hydrated) return null;
  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationGate>
        <Stack screenOptions={{ headerShown: false }} />
      </HydrationGate>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 2: 앱 실행 후 오류 없음 확인**

```bash
# stock-watcher 디렉토리에서
pnpm expo run:ios
```

콘솔에 holdingsStore 관련 오류 없으면 정상.

- [ ] **Step 3: 커밋**

```bash
git add app/_layout.tsx
git commit -m "feat: hydrate holdingsStore on app start"
```

---

## Task 4: 환율 API 함수 추가

**Files:**
- Modify: `src/api/yahoo.ts`

- [ ] **Step 1: `src/api/yahoo.ts` 파일 끝에 두 함수 추가**

```typescript
// 현재 USD→KRW 환율 (실시간)
export async function fetchCurrentExchangeRate(): Promise<number> {
  const result = await fetchYahooChart('KRW=X', '5d');
  const rate = result.meta.regularMarketPrice as number;
  if (!rate) throw new Error('환율 데이터 없음');
  return rate;
}

// 특정일 USD→KRW 환율 (과거)
// 주말/공휴일이면 해당일 이전 가장 가까운 영업일 환율 반환
export async function fetchHistoricalExchangeRate(date: string): Promise<number> {
  const result = await fetchYahooChart('KRW=X', '2y');
  const timestamps: number[] = result.timestamp ?? [];
  const closes: number[] = result.indicators?.quote?.[0]?.close ?? [];

  const targetMs = new Date(date).getTime() + 86400000; // 해당일 자정 + 하루 여유

  let bestIdx = -1;
  for (let i = 0; i < timestamps.length; i++) {
    if (closes[i] == null) continue;
    if (timestamps[i] * 1000 <= targetMs) {
      bestIdx = i;
    } else {
      break;
    }
  }

  if (bestIdx === -1) throw new Error(`환율 데이터 없음: ${date}`);
  return closes[bestIdx];
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/api/yahoo.ts
git commit -m "feat: add exchange rate fetch functions (current + historical)"
```

---

## Task 5: useHoldingPnL 훅 생성

**Files:**
- Create: `src/hooks/useHoldingPnL.ts`

- [ ] **Step 1: `src/hooks/useHoldingPnL.ts` 생성**

```typescript
import { useQuery, useQueries } from '@tanstack/react-query';
import { Holding } from '../types';
import { fetchCurrentExchangeRate, fetchHistoricalExchangeRate } from '../api/yahoo';

export interface HoldingPnLResult {
  totalPnL: number;       // 원화 기준 총 손익
  pnlPercent: number;     // 수익률 (%)
  perHolding: { id: string; pnl: number }[]; // 매수건별 손익 (원화)
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

  const usdHoldings = holdings.filter((h) => h.currency === 'USD');
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

  if (holdings.length === 0) return empty;

  const isLoading = hasUsd && (fxNowLoading || historicalResults.some((r) => r.isLoading));
  const isError = hasUsd && (fxNowError || historicalResults.some((r) => r.isError));

  if (isLoading || isError) return { ...empty, isLoading, isError };

  // 날짜 → 환율 맵 구성
  const fxByDate: Record<string, number> = {};
  uniqueDates.forEach((date, i) => {
    const rate = historicalResults[i]?.data;
    if (rate != null) fxByDate[date] = rate;
  });

  let totalCost = 0;
  let totalValue = 0;
  const perHolding: { id: string; pnl: number }[] = [];

  for (const h of holdings) {
    let cost: number;
    let value: number;

    if (h.currency === 'KRW') {
      cost = h.shares * h.pricePerShare;
      value = h.shares * currentPrice;
    } else {
      const fxAtPurchase = fxByDate[h.purchaseDate];
      if (fxAtPurchase == null || fxNow == null) continue;
      cost = h.shares * h.pricePerShare * fxAtPurchase;
      value = h.shares * currentPrice * fxNow;
    }

    totalCost += cost;
    totalValue += value;
    perHolding.push({ id: h.id, pnl: value - cost });
  }

  const totalPnL = totalValue - totalCost;
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  return { totalPnL, pnlPercent, perHolding, isLoading: false, isError: false };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/hooks/useHoldingPnL.ts
git commit -m "feat: add useHoldingPnL hook for P&L calculation"
```

---

## Task 6: stocksStore 종목 삭제 시 holdings 정리

**Files:**
- Modify: `src/stores/stocksStore.ts`

- [ ] **Step 1: `stocksStore.ts`에 holdingsStore import 및 clearHoldings 호출 추가**

파일 상단 import 블록에 추가:
```typescript
import { useHoldingsStore } from './holdingsStore';
```

`removeStock` 함수의 마지막 줄에 추가:
```typescript
removeStock: (ticker: string) => {
  const next = get().stocks.filter((s) => s.ticker !== ticker);
  set({ stocks: next });
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  AsyncStorage.removeItem(`@alerts:${ticker}`);
  AsyncStorage.removeItem(`@alert_enabled:${ticker}`);
  useAlertStore.getState().removeAlert(ticker);
  useHoldingsStore.getState().clearHoldings(ticker); // 추가
},
```

- [ ] **Step 2: 동작 확인**

앱에서 보유 내역이 있는 종목을 롱프레스로 삭제 후 재추가했을 때 이전 보유 내역이 남지 않으면 정상.

- [ ] **Step 3: 커밋**

```bash
git add src/stores/stocksStore.ts
git commit -m "feat: clear holdings when stock is removed"
```

---

## Task 7: 상세 화면에 보유 현황 섹션 + 추가 모달

**Files:**
- Modify: `app/stock/[ticker].tsx`

- [ ] **Step 1: 전체 파일을 아래 내용으로 교체**

```typescript
// app/stock/[ticker].tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator,
  Modal, TextInput, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStockPrice } from '../../src/hooks/useStockPrice';
import { useStockCandles } from '../../src/hooks/useStockCandles';
import { useAlertStore } from '../../src/stores/alertStore';
import { useHoldingsStore } from '../../src/stores/holdingsStore';
import { useHoldingPnL } from '../../src/hooks/useHoldingPnL';
import { PriceChart } from '../../src/components/PriceChart';
import { Badge } from '../../src/components/Badge';
import { getCardStatus } from '../../src/utils/cardStyle';
import { formatCurrency, formatChangeSign, isKoreanStock } from '../../src/utils/format';
import { Period, Holding } from '../../src/types';

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y'];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export default function StockDetailScreen() {
  const { ticker, name } = useLocalSearchParams<{ ticker: string; name: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('1M');

  // 모달 상태
  const [modalVisible, setModalVisible] = useState(false);
  const [inputDate, setInputDate] = useState('');
  const [inputShares, setInputShares] = useState('');
  const [inputPrice, setInputPrice] = useState('');

  const { data: quote, isLoading: quoteLoading } = useStockPrice(ticker);
  const { data: candles, isLoading: candlesLoading } = useStockCandles(ticker, period);
  const { getAlert } = useAlertStore();
  const { getHoldings, addHolding, removeHolding } = useHoldingsStore();

  const alert = getAlert(ticker);
  const holdings = getHoldings(ticker);
  const { totalPnL, pnlPercent, perHolding, isLoading: pnlLoading, isError: pnlError } =
    useHoldingPnL(holdings, quote?.currentPrice ?? 0);

  const status = quote && alert
    ? getCardStatus(quote.currentPrice, alert.targetPrice, alert.stopLossPrice)
    : 'normal';

  const targetPrice = alert?.targetPrice ?? (quote ? quote.currentPrice * 1.1 : 0);
  const stopLossPrice = alert?.stopLossPrice ?? (quote ? quote.currentPrice * 0.9 : 0);

  const handleAddHolding = () => {
    const shares = parseInt(inputShares, 10);
    const price = parseFloat(inputPrice);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(inputDate)) {
      Alert.alert('오류', '날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    if (new Date(inputDate) > new Date()) {
      Alert.alert('오류', '미래 날짜는 입력할 수 없습니다.');
      return;
    }
    if (!Number.isInteger(shares) || shares < 1) {
      Alert.alert('오류', '주수는 1 이상의 정수로 입력해주세요.');
      return;
    }
    if (isNaN(price) || price <= 0) {
      Alert.alert('오류', '매수가는 0보다 큰 숫자로 입력해주세요.');
      return;
    }

    const holding: Holding = {
      id: generateId(),
      ticker,
      shares,
      pricePerShare: price,
      purchaseDate: inputDate,
      currency: isKoreanStock(ticker) ? 'KRW' : 'USD',
    };
    addHolding(holding);
    setModalVisible(false);
    setInputDate('');
    setInputShares('');
    setInputPrice('');
  };

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

  const pnlColor = totalPnL >= 0 ? '#00e676' : '#FF1744';
  const currency = isKoreanStock(ticker) ? 'KRW' : 'USD';
  const priceSymbol = currency === 'KRW' ? '₩' : '$';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#c8caff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{name ?? ticker}</Text>
        <TouchableOpacity onPress={() => router.push(`/alert-settings?ticker=${ticker}&name=${name}`)}>
          <Ionicons name="notifications-outline" size={24} color="#c8caff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* 히어로 영역 */}
        {quoteLoading ? (
          <ActivityIndicator color="#5b9bd5" style={{ marginTop: 32 }} />
        ) : quote ? (
          <View style={styles.hero}>
            <Text style={styles.price}>{formatCurrency(quote.currentPrice, ticker)}</Text>
            <Text style={[styles.change, { color: quote.change >= 0 ? '#00e676' : '#FF1744' }]}>
              {formatChangeSign(quote.change)}{' '}
              {formatCurrency(Math.abs(quote.change), ticker)}{' '}
              ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
            </Text>
            <Badge status={status} />
          </View>
        ) : null}

        {/* 기간 탭 */}
        <View style={styles.periodTabs}>
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.tab, period === p && styles.tabActive]}
              onPress={() => setPeriod(p)}
            >
              <Text style={[styles.tabText, period === p && styles.tabTextActive]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 차트 */}
        {candlesLoading ? (
          <ActivityIndicator color="#5b9bd5" style={{ margin: 32 }} />
        ) : candles && candles.length > 0 ? (
          <PriceChart
            data={candles}
            ticker={ticker}
            targetPrice={targetPrice}
            stopLossPrice={stopLossPrice}
          />
        ) : (
          <Text style={styles.noData}>차트 데이터 없음</Text>
        )}

        {/* 알림 설정 요약 */}
        {alert && (
          <View style={styles.alertSummary}>
            <Text style={styles.alertTitle}>알림 설정</Text>
            <Text style={styles.alertRow}>🎯 목표가: {formatCurrency(alert.targetPrice, ticker)}</Text>
            <Text style={styles.alertRow}>🛑 손절가: {formatCurrency(alert.stopLossPrice, ticker)}</Text>
          </View>
        )}

        {/* 내 보유 현황 */}
        <View style={styles.holdingsSection}>
          <Text style={styles.holdingsTitle}>내 보유 현황</Text>

          {holdings.length > 0 && (
            <View style={styles.pnlSummary}>
              {pnlLoading ? (
                <ActivityIndicator color="#5b9bd5" size="small" />
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

          {holdings.map((h) => {
            const pnlEntry = perHolding.find((p) => p.id === h.id);
            const pnl = pnlEntry?.pnl;
            return (
              <TouchableOpacity
                key={h.id}
                style={styles.holdingRow}
                onLongPress={() => handleRemoveHolding(h.id, h.purchaseDate)}
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

          <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
            <Ionicons name="add-circle-outline" size={18} color="#5b9bd5" />
            <Text style={styles.addButtonText}>매수 내역 추가</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 매수 내역 추가 모달 */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>매수 내역 추가</Text>

            <Text style={styles.inputLabel}>매수일 (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              value={inputDate}
              onChangeText={setInputDate}
              placeholder="예: 2024-03-15"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />

            <Text style={styles.inputLabel}>주수</Text>
            <TextInput
              style={styles.input}
              value={inputShares}
              onChangeText={setInputShares}
              placeholder="예: 10"
              placeholderTextColor="#555"
              keyboardType="number-pad"
            />

            <Text style={styles.inputLabel}>
              매수가 ({currency === 'KRW' ? '원' : '달러'})
            </Text>
            <TextInput
              style={styles.input}
              value={inputPrice}
              onChangeText={setInputPrice}
              placeholder={currency === 'KRW' ? '예: 73400' : '예: 650.00'}
              placeholderTextColor="#555"
              keyboardType="decimal-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setModalVisible(false);
                  setInputDate('');
                  setInputShares('');
                  setInputPrice('');
                }}
              >
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnConfirm]} onPress={handleAddHolding}>
                <Text style={styles.modalBtnConfirmText}>추가</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { paddingHorizontal: 16, paddingBottom: 60 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  price: { fontSize: 36, fontWeight: '800', color: '#ffffff' },
  change: { fontSize: 16, marginVertical: 8 },
  periodTabs: { flexDirection: 'row', marginVertical: 16, backgroundColor: '#1c1f33', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#2d3150' },
  tabText: { color: '#555', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#c8caff' },
  noData: { color: '#555', textAlign: 'center', marginTop: 32 },
  alertSummary: { backgroundColor: '#1c1f33', borderRadius: 12, padding: 16, marginTop: 16 },
  alertTitle: { color: '#c8caff', fontWeight: '700', marginBottom: 8 },
  alertRow: { color: '#888', fontSize: 14, marginVertical: 3 },
  // 보유 현황
  holdingsSection: { backgroundColor: '#1c1f33', borderRadius: 12, padding: 16, marginTop: 16 },
  holdingsTitle: { color: '#c8caff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  pnlSummary: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2d3150' },
  pnlTotal: { fontSize: 16, fontWeight: '700' },
  pnlError: { color: '#FF1744', fontSize: 13 },
  holdingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2d3150',
  },
  holdingDate: { color: '#c8caff', fontSize: 13, fontWeight: '600' },
  holdingMeta: { color: '#888', fontSize: 12, marginTop: 2 },
  holdingPnl: { fontSize: 13, fontWeight: '700' },
  holdingPnlPlaceholder: { color: '#555', fontSize: 13 },
  addButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 12, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: '#2d3150', borderStyle: 'dashed',
  },
  addButtonText: { color: '#5b9bd5', fontSize: 14, marginLeft: 6 },
  // 모달
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: '#1c1f33', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 36,
  },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 20 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0e1117', borderRadius: 8, borderWidth: 1, borderColor: '#2d3150',
    color: '#ffffff', fontSize: 15, paddingHorizontal: 14, paddingVertical: 12,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#2d3150' },
  modalBtnCancelText: { color: '#888', fontWeight: '600' },
  modalBtnConfirm: { backgroundColor: '#5b9bd5' },
  modalBtnConfirmText: { color: '#ffffff', fontWeight: '700' },
});
```

- [ ] **Step 2: 앱 실행 후 동작 확인**

```bash
pnpm expo run:ios
```

확인 항목:
1. 종목 상세 화면 하단에 "내 보유 현황" 섹션 표시
2. "매수 내역 추가" 버튼 → 모달 열림
3. 잘못된 입력(미래 날짜, 0주, 음수 가격)에서 오류 Alert 표시
4. 정상 입력 후 매수 내역 목록에 표시
5. KRW 종목(삼성전자): 원화 손익 즉시 표시
6. USD 종목(NVDA): 환율 로딩 후 원화 손익 표시
7. 매수 내역 롱프레스 → 삭제 Alert → 삭제 후 목록에서 제거
8. 앱 재시작 후 매수 내역이 유지됨 (AsyncStorage 확인)

- [ ] **Step 3: 커밋**

```bash
git add app/stock/[ticker].tsx
git commit -m "feat: add portfolio holdings section and add-holding modal to stock detail screen"
```
