// app/stock/[ticker].tsx
import React, { useState, useCallback } from 'react';
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
import { fetchHistoricalStockPrice } from '../../src/api/yahoo';
import { Period, Holding } from '../../src/types';

const PERIODS: Period[] = ['1M', '3M', '6M', '1Y'];

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function StockDetailScreen() {
  const { ticker, name } = useLocalSearchParams<{ ticker: string; name: string }>();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>('1M');

  const [modalVisible, setModalVisible] = useState(false);
  const [inputDate, setInputDate] = useState('');
  const [inputShares, setInputShares] = useState('');
  const [fetchedPrice, setFetchedPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [priceError, setPriceError] = useState<string | null>(null);

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

  const handleDateBlur = useCallback(async () => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(inputDate)) return;
    const parsedDate = new Date(inputDate);
    if (isNaN(parsedDate.getTime()) || parsedDate > new Date()) return;

    setPriceLoading(true);
    setPriceError(null);
    setFetchedPrice(null);
    try {
      const price = await fetchHistoricalStockPrice(ticker, inputDate);
      setFetchedPrice(price);
    } catch {
      setPriceError('가격 조회 실패');
    } finally {
      setPriceLoading(false);
    }
  }, [inputDate, ticker]);

  const resetModal = () => {
    setInputDate('');
    setInputShares('');
    setFetchedPrice(null);
    setPriceError(null);
    setPriceLoading(false);
  };

  const handleAddHolding = () => {
    const shares = parseInt(inputShares, 10);
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (!dateRegex.test(inputDate)) {
      Alert.alert('오류', '날짜를 YYYY-MM-DD 형식으로 입력해주세요.');
      return;
    }
    const parsedDate = new Date(inputDate);
    if (isNaN(parsedDate.getTime())) {
      Alert.alert('오류', '유효한 날짜를 입력해주세요.');
      return;
    }
    if (parsedDate > new Date()) {
      Alert.alert('오류', '미래 날짜는 입력할 수 없습니다.');
      return;
    }
    if (!Number.isInteger(shares) || shares < 1) {
      Alert.alert('오류', '주수는 1 이상의 정수로 입력해주세요.');
      return;
    }
    if (fetchedPrice == null) {
      Alert.alert('오류', '매수일 가격을 조회 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const holding: Holding = {
      id: generateId(),
      ticker,
      shares,
      pricePerShare: fetchedPrice,
      purchaseDate: inputDate,
      currency: isKoreanStock(ticker) ? 'KRW' : 'USD',
    };
    addHolding(holding);
    setModalVisible(false);
    resetModal();
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

        {alert && (
          <View style={styles.alertSummary}>
            <Text style={styles.alertTitle}>알림 설정</Text>
            <Text style={styles.alertRow}>🎯 목표가: {formatCurrency(alert.targetPrice, ticker)}</Text>
            <Text style={styles.alertRow}>🛑 손절가: {formatCurrency(alert.stopLossPrice, ticker)}</Text>
          </View>
        )}

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
              onBlur={handleDateBlur}
              placeholder="예: 2024-03-15"
              placeholderTextColor="#555"
              keyboardType="numbers-and-punctuation"
            />
            {priceLoading && (
              <ActivityIndicator color="#5b9bd5" size="small" style={{ marginTop: 8 }} />
            )}
            {!priceLoading && fetchedPrice != null && (
              <Text style={styles.fetchedPrice}>
                📈 당일 종가: {priceSymbol}{fetchedPrice.toLocaleString()}
              </Text>
            )}
            {!priceLoading && priceError != null && (
              <Text style={styles.fetchedPriceError}>{priceError}</Text>
            )}

            <Text style={styles.inputLabel}>주수</Text>
            <TextInput
              style={styles.input}
              value={inputShares}
              onChangeText={setInputShares}
              placeholder="예: 10"
              placeholderTextColor="#555"
              keyboardType="number-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => {
                  setModalVisible(false);
                  resetModal();
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
  fetchedPrice: { color: '#00e676', fontSize: 13, marginTop: 8 },
  fetchedPriceError: { color: '#FF1744', fontSize: 13, marginTop: 8 },
});
