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
