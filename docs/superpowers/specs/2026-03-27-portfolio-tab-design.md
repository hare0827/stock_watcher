# 포트폴리오 탭 설계

**날짜:** 2026-03-27
**상태:** 승인됨

---

## 개요

탭바에 포트폴리오 전용 탭을 추가한다. 매수 내역이 있는 종목의 총 손익, 도넛 차트(종목별 비중), 종목별 손익 리스트를 한 화면에서 볼 수 있다. 탭은 보기 전용이며 탭해도 다른 화면으로 이동하지 않는다.

---

## 요구사항

- 탭바에 "포트폴리오" 탭 추가 (홈 / 포트폴리오 / 설정)
- 매수 내역이 있는 종목만 표시
- 매수 내역이 하나도 없으면 빈 상태 메시지 표시
- 종목 행 탭 시 이동 없음 (보기 전용)
- 화면 구성 (위→아래):
  1. 총 손익 헤더 (금액 + 수익률 %)
  2. 도넛 차트 + 종목 범례
  3. 종목별 손익 리스트

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `app/(tabs)/portfolio.tsx` | 신규 — 포트폴리오 탭 화면 |
| `src/components/DonutChart.tsx` | 신규 — SVG 도넛 차트 컴포넌트 |
| `app/(tabs)/_layout.tsx` | 수정 — 탭 1개 추가 |

---

## 아키텍처

### 데이터 흐름

```
usePortfolioSummary()
  → totalPnL, pnlPercent, isLoading, isError
  → segments[]: { ticker, name, color, weight }

useStocksStore() + useHoldingsStore() + useHoldingPnL()
  → 종목별 totalPnL, pnlPercent (리스트 렌더링용)
```

`usePortfolioSummary`는 이미 구현되어 있으며 totalPnL, pnlPercent, segments를 반환한다. 종목별 개별 손익은 `portfolio.tsx` 내부에서 각 종목에 대해 `useHoldingPnL`을 호출해 얻는다.

### DonutChart 컴포넌트

```typescript
interface DonutChartProps {
  segments: { color: string; weight: number }[];
  size?: number;        // 기본 120
  strokeWidth?: number; // 기본 22
  centerLabel?: string; // 중앙 텍스트 (예: "4종목")
}
```

- `react-native-svg`의 `Circle` + `strokeDasharray` / `strokeDashoffset` 패턴으로 각 세그먼트를 원형 진행 바로 표현
- 각 세그먼트: weight → 원주 길이 비율로 변환
- 세그먼트 간 gap 2px

### portfolio.tsx 구성

```
<ScrollView>
  {summary === null
    ? <EmptyState />
    : <>
        <PnLHeader totalPnL={} pnlPercent={} />
        <DonutChart segments={summary.segments} centerLabel={`${n}종목`} />
        <Legend segments={summary.segments} />
        <StockPnLList stocks={holdingStocks} />
      </>
  }
</ScrollView>
```

`holdingStocks`: `stocks` 중 `getHoldings(ticker).length > 0`인 것만 필터

### 종목별 손익 리스트 행

각 행:
- 왼쪽: 색 점 + 종목명 + `ticker · N주 · 현재가` (N주 = 순보유량: 매수주수 - 매도주수)
- 오른쪽: `±₩손익` + `±X.XX%`

`StockPnLRow`는 `useStockPrice(ticker)`로 현재가를 조회하고, `useHoldingPnL(holdings, currentPrice)`로 손익을 계산한다. `useHoldingPnL`은 hooks-of-hooks 문제 때문에 각 행을 별도 컴포넌트(`StockPnLRow`)로 분리해 호출한다.

---

## 빈 상태

`usePortfolioSummary()`가 `null`을 반환하면 (보유 내역 없음):

```
📊
아직 보유 종목이 없어요
종목 상세 화면에서 매수 내역을 추가해보세요
```

---

## 탭 추가

`app/(tabs)/_layout.tsx`에 홈과 설정 사이에 탭 추가:

```typescript
<Tabs.Screen
  name="portfolio"
  options={{
    title: '포트폴리오',
    tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} />,
  }}
/>
```

---

## 테스트

| 테스트 파일 | 검증 내용 |
|------------|----------|
| `__tests__/components/DonutChart.test.tsx` | segments 없으면 아무것도 렌더링 안 됨, 정상 렌더링 |
| `__tests__/components/StockPnLRow.test.tsx` | 양수/음수 손익 색상, 주수/현재가 표시 |
