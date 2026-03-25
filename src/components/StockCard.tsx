// src/components/StockCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Stock, StockQuote, AlertConfig } from '../types';
import { getCardStatus, getCardColors } from '../utils/cardStyle';
import { formatCurrency, formatChangeSign } from '../utils/format';
import { Badge } from './Badge';

interface Props {
  stock: Stock;
  quote: StockQuote | undefined;
  alert: Omit<AlertConfig, 'ticker'> | undefined;
  onPress: () => void;
}

export function StockCard({ stock, quote, alert, onPress }: Props) {
  const status = quote && alert
    ? getCardStatus(quote.currentPrice, alert.targetPrice, alert.stopLossPrice)
    : 'normal';
  const colors = getCardColors(status);

  return (
    <TouchableOpacity
      testID="stock-card"
      onPress={onPress}
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{stock.name}</Text>
          <Text style={styles.ticker}>{stock.ticker}</Text>
        </View>
        <Badge status={status} />
      </View>

      {quote ? (
        <>
          <Text style={styles.price}>
            {formatCurrency(quote.currentPrice, stock.ticker)}
          </Text>
          <Text style={[styles.change, { color: quote.change >= 0 ? '#00e676' : '#FF1744' }]}>
            {formatChangeSign(quote.change)}{' '}
            {formatCurrency(Math.abs(quote.change), stock.ticker)}{' '}
            ({quote.changePercent >= 0 ? '+' : ''}{quote.changePercent.toFixed(2)}%)
          </Text>
          {alert && (
            <Text style={styles.meta}>
              🎯 {formatCurrency(alert.targetPrice, stock.ticker)}
              {'  '}🛑 {formatCurrency(alert.stopLossPrice, stock.ticker)}
            </Text>
          )}
        </>
      ) : (
        <Text style={styles.loading}>로딩 중...</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14, padding: 18, marginBottom: 10,
    borderWidth: 1.5,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  name: { fontSize: 15, fontWeight: '700', color: '#c8caff' },
  ticker: { fontSize: 11, color: '#777', marginTop: 2 },
  price: { fontSize: 26, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  change: { fontSize: 14, marginBottom: 8 },
  meta: { fontSize: 12, color: '#888', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 8 },
  loading: { fontSize: 14, color: '#555' },
});
