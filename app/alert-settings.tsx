// app/alert-settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, Switch, TouchableOpacity,
  StyleSheet, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAlertStore } from '../src/stores/alertStore';
import { useStockPrice } from '../src/hooks/useStockPrice';
import { isKoreanStock, formatCurrency } from '../src/utils/format';

export default function AlertSettingsScreen() {
  const { ticker, name } = useLocalSearchParams<{ ticker: string; name: string }>();
  const router = useRouter();
  const { getAlert, setAlert } = useAlertStore();
  const { data: quote } = useStockPrice(ticker);
  const existing = getAlert(ticker);

  const currentPrice = quote?.currentPrice ?? 0;
  const isKR = isKoreanStock(ticker);
  const step = isKR ? 500 : 0.5;

  const defaultTarget = existing?.targetPrice ?? Math.round(currentPrice * 1.1 / step) * step;
  const defaultStop = existing?.stopLossPrice ?? Math.round(currentPrice * 0.9 / step) * step;

  const [targetPrice, setTargetPrice] = useState(String(defaultTarget));
  const [stopLossPrice, setStopLossPrice] = useState(String(defaultStop));
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);

  useEffect(() => {
    if (!existing && currentPrice > 0) {
      setTargetPrice(String(Math.round(currentPrice * 1.1 / step) * step));
      setStopLossPrice(String(Math.round(currentPrice * 0.9 / step) * step));
    }
  }, [currentPrice, existing, step]);

  const handleSave = async () => {
    await setAlert(ticker, {
      targetPrice: parseFloat(targetPrice),
      stopLossPrice: parseFloat(stopLossPrice),
      enabled,
    });
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>{name ?? ticker} 알림 설정</Text>

        {currentPrice > 0 && (
          <Text style={styles.current}>현재가: {formatCurrency(currentPrice, ticker)}</Text>
        )}

        <Text style={styles.label}>🎯 목표가</Text>
        <TextInput
          style={styles.input}
          value={targetPrice}
          onChangeText={setTargetPrice}
          keyboardType="numeric"
          placeholder={isKR ? '정수 입력' : '소수점 입력'}
          placeholderTextColor="#555"
        />

        <Text style={styles.label}>🛑 손절가</Text>
        <TextInput
          style={styles.input}
          value={stopLossPrice}
          onChangeText={setStopLossPrice}
          keyboardType="numeric"
          placeholder={isKR ? '정수 입력' : '소수점 입력'}
          placeholderTextColor="#555"
        />

        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>인앱 알림 (포어그라운드 전용)</Text>
          <Switch
            value={enabled}
            onValueChange={setEnabled}
            trackColor={{ true: '#5b9bd5', false: '#333' }}
            thumbColor={enabled ? '#ffffff' : '#aaa'}
          />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
          <Text style={styles.saveBtnText}>저장</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  content: { padding: 24 },
  title: { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 8 },
  current: { color: '#888', marginBottom: 24 },
  label: { fontSize: 13, color: '#888', marginTop: 20, marginBottom: 6 },
  input: {
    backgroundColor: '#1c1f33', borderRadius: 10, padding: 14,
    color: '#ffffff', fontSize: 16, borderWidth: 1, borderColor: '#2d3150',
  },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 28, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#2d3150',
  },
  toggleLabel: { color: '#c8caff', fontSize: 15 },
  saveBtn: { backgroundColor: '#5b9bd5', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 32 },
  saveBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
