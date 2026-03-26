// app/edit-stock.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStocksStore } from '../src/stores/stocksStore';
import { fetchQuote } from '../src/api/finnhub';
import { formatCurrency } from '../src/utils/format';

export default function EditStockScreen() {
  const router = useRouter();
  const { ticker: rawTicker } = useLocalSearchParams<{ ticker: string }>();
  const { stocks, editStock } = useStocksStore();
  const queryClient = useQueryClient();

  const original = stocks.find((s) => s.ticker === rawTicker);

  const [name, setName] = useState(original?.name ?? '');
  const [ticker, setTicker] = useState(original?.ticker ?? '');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickerValid, setTickerValid] = useState<boolean | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleTickerBlur = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    // 티커가 원본과 동일하면 검증 스킵
    if (t === original?.ticker) {
      setPreview(null);
      setError(null);
      setTickerValid(true);
      return;
    }
    setLoading(true);
    setError(null);
    setTickerValid(null);
    try {
      const quote = await fetchQuote(t);
      setPreview(formatCurrency(quote.currentPrice, t));
      setTickerValid(true);
    } catch {
      const isKoreanPattern = /^\d{6}$/.test(t);
      setError(
        isKoreanPattern
          ? `한국 주식은 ".KS"(코스피) 또는 ".KQ"(코스닥)를 붙여주세요. 예: ${t}.KS`
          : '티커를 찾을 수 없습니다. 정확히 입력해 주세요.'
      );
      setPreview(null);
      setTickerValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const n = name.trim();
    const t = ticker.trim().toUpperCase();
    setError(null);
    setIsSaving(true);
    try {
      await editStock(rawTicker!, { name: n, ticker: t });
      if (t !== rawTicker) {
        queryClient.removeQueries({ queryKey: ['quote', rawTicker] });
      }
      router.back();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (!original) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Text style={styles.errorText}>종목을 찾을 수 없습니다.</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelText}>돌아가기</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isUnchanged = name.trim() === original.name && ticker.trim().toUpperCase() === original.ticker;
  const tickerChanged = ticker.trim().toUpperCase() !== original.ticker;
  const isSaveDisabled = !name || !ticker || tickerValid === false || isUnchanged || (tickerChanged && tickerValid !== true);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>종목 편집</Text>

        <Text style={styles.label}>표시명</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={(v) => setName(v)}
          placeholder="예: 애플"
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>티커 심볼</Text>
        <TextInput
          style={styles.input}
          value={ticker}
          onChangeText={(v) => {
            setTicker(v.toUpperCase());
            setError(null);
            setPreview(null);
            setTickerValid(null);
          }}
          onBlur={handleTickerBlur}
          placeholder="예: AAPL  또는  005380.KS"
          placeholderTextColor="#555"
          autoCapitalize="characters"
        />

        {loading && <ActivityIndicator color="#5b9bd5" style={{ marginTop: 8 }} />}
        {preview && <Text style={styles.preview}>현재가: {preview}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (isSaveDisabled || isSaving) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={isSaveDisabled || isSaving}
        >
          <Text style={styles.buttonText}>저장</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>취소</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  content: { padding: 24 },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 24 },
  label: { fontSize: 13, color: '#888', marginBottom: 6, marginTop: 16 },
  input: {
    backgroundColor: '#1c1f33', borderRadius: 10, padding: 14,
    color: '#ffffff', fontSize: 15, borderWidth: 1, borderColor: '#2d3150',
  },
  preview: { color: '#00e676', marginTop: 8, fontSize: 14 },
  errorText: { color: '#FF1744', fontSize: 13, marginTop: 6 },
  button: {
    backgroundColor: '#5b9bd5', borderRadius: 12, padding: 16,
    alignItems: 'center', marginTop: 32,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  cancelBtn: { alignItems: 'center', marginTop: 16 },
  cancelText: { color: '#888', fontSize: 15 },
});
