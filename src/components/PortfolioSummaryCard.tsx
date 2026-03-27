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
          <Text testID="portfolio-pnl" style={StyleSheet.flatten([styles.pnl, { color: pnlColor }])}>
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
