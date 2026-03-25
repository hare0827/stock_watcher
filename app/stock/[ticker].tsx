// app/stock/[ticker].tsx
import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStockPrice } from '../../src/hooks/useStockPrice';
import { useStockCandles } from '../../src/hooks/useStockCandles';
import { useAlertStore } from '../../src/stores/alertStore';
import { PriceChart } from '../../src/components/PriceChart';
import { Badge } from '../../src/components/Badge';
import { getCardStatus } from '../../src/utils/cardStyle';
import { formatCurrency, formatChangeSign } from '../../src/utils/format';
import { Period } from '../../src/types';

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y'];

export default function StockDetailScreen() {
  const { ticker, name } = useLocalSearchParams<{ ticker: string; name: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('1M');

  const { data: quote, isLoading: quoteLoading } = useStockPrice(ticker);
  const { data: candles, isLoading: candlesLoading } = useStockCandles(ticker, period);
  const { getAlert } = useAlertStore();
  const alert = getAlert(ticker);

  const status = quote && alert
    ? getCardStatus(quote.currentPrice, alert.targetPrice, alert.stopLossPrice)
    : 'normal';

  const targetPrice = alert?.targetPrice ?? (quote ? quote.currentPrice * 1.1 : 0);
  const stopLossPrice = alert?.stopLossPrice ?? (quote ? quote.currentPrice * 0.9 : 0);

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
            <Text style={styles.alertRow}>
              🎯 목표가: {formatCurrency(alert.targetPrice, ticker)}
            </Text>
            <Text style={styles.alertRow}>
              🛑 손절가: {formatCurrency(alert.stopLossPrice, ticker)}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#ffffff' },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
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
});
