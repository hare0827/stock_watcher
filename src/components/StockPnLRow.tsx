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
  const { totalPnL, pnlPercent, isLoading, netShares } = useHoldingPnL(holdings, currentPrice);

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
