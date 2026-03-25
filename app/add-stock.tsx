// app/add-stock.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, SafeAreaView, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { useStocksStore } from '../src/stores/stocksStore';
import { fetchQuote } from '../src/api/finnhub';
import { formatCurrency } from '../src/utils/format';

export default function AddStockScreen() {
  const router = useRouter();
  const { addStock, stocks } = useStocksStore();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTickerBlur = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      const quote = await fetchQuote(t);
      setPreview(formatCurrency(quote.currentPrice, t));
    } catch {
      setError('티커를 찾을 수 없습니다. 정확히 입력해 주세요.');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    const n = name.trim();
    const t = ticker.trim().toUpperCase();
    setError(null);
    try {
      addStock({ name: n, ticker: t });
      router.back();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const maxReached = stocks.length >= 20;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>종목 추가</Text>

        {maxReached && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>종목은 최대 20개까지 등록 가능합니다.</Text>
          </View>
        )}

        <Text style={styles.label}>표시명</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="예: 애플"
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>티커 심볼</Text>
        <TextInput
          style={styles.input}
          value={ticker}
          onChangeText={(v) => setTicker(v.toUpperCase())}
          onBlur={handleTickerBlur}
          placeholder="예: AAPL  또는  005380.KS"
          placeholderTextColor="#555"
          autoCapitalize="characters"
        />

        {loading && <ActivityIndicator color="#5b9bd5" style={{ marginTop: 8 }} />}
        {preview && <Text style={styles.preview}>현재가: {preview}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}

        <TouchableOpacity
          style={[styles.button, (maxReached || !name || !ticker) && styles.buttonDisabled]}
          onPress={handleAdd}
          disabled={maxReached || !name || !ticker}
        >
          <Text style={styles.buttonText}>추가</Text>
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
  errorBox: { backgroundColor: '#2b0d0d', padding: 12, borderRadius: 8, marginBottom: 8 },
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
