// src/components/StockCard.tsx
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActionSheetIOS } from 'react-native';
import { Stock, StockQuote, AlertConfig } from '../types';
import { getCardStatus, getCardColors } from '../utils/cardStyle';
import { formatCurrency, formatChangeSign } from '../utils/format';
import { Badge } from './Badge';

interface Props {
  stock: Stock;
  quote: StockQuote | undefined;
  alert: Omit<AlertConfig, 'ticker'> | undefined;
  onPress: () => void;
  onLongPress?: () => void;
  onEdit?: () => void;
}

export function StockCard({ stock, quote, alert, onPress, onLongPress, onEdit }: Props) {
  const status = useMemo(
    () =>
      quote && alert
        ? getCardStatus(quote.currentPrice, alert.targetPrice, alert.stopLossPrice)
        : 'normal',
    [quote?.currentPrice, alert?.targetPrice, alert?.stopLossPrice]
  );
  const colors = useMemo(() => getCardColors(status), [status]);

  const handleMorePress = () => {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ['취소', '편집', '삭제'],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
      },
      (buttonIndex) => {
        if (buttonIndex === 1) onEdit?.();
        if (buttonIndex === 2) onLongPress?.();
      }
    );
  };

  return (
    <TouchableOpacity
      testID="stock-card"
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, { borderColor: colors.border, backgroundColor: colors.background }]}
      activeOpacity={0.85}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.name}>{stock.name}</Text>
          <Text style={styles.ticker}>{stock.ticker}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Badge status={status} />
          <TouchableOpacity onPress={handleMorePress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.moreBtn}>⋮</Text>
          </TouchableOpacity>
        </View>
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
  moreBtn: { color: '#666', fontSize: 20, lineHeight: 22 },
});
