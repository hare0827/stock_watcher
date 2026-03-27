// app/(tabs)/index.tsx
import React, { useState, useCallback, useMemo } from 'react';
import {
  View, FlatList, StyleSheet,
  TouchableOpacity, Text, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useStocksStore } from '../../src/stores/stocksStore';
import { useAlertStore } from '../../src/stores/alertStore';
import { useStockPrice } from '../../src/hooks/useStockPrice';
import { useAlertCheck } from '../../src/hooks/useAlertCheck';
import { StockCard } from '../../src/components/StockCard';
import { InAppAlert } from '../../src/components/InAppAlert';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { PortfolioSummaryCard } from '../../src/components/PortfolioSummaryCard';
import { AlertEvent, Stock } from '../../src/types';

function StockCardWrapper({ stock }: { stock: Stock }) {
  const router = useRouter();
  const { data: quote } = useStockPrice(stock.ticker);
  const { getAlert } = useAlertStore();
  const { removeStock } = useStocksStore();
  const alert = getAlert(stock.ticker);

  const handleLongPress = useCallback(() => {
    Alert.alert(
      `${stock.name} 삭제`,
      '이 종목을 목록에서 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => removeStock(stock.ticker) },
      ]
    );
  }, [stock.name, stock.ticker, removeStock]);

  const handleEdit = useCallback(() => {
    router.push(`/edit-stock?ticker=${encodeURIComponent(stock.ticker)}`);
  }, [stock.ticker, router]);

  const handleDelete = useCallback(() => {
    removeStock(stock.ticker);
  }, [stock.ticker, removeStock]);

  return (
    <StockCard
      stock={stock}
      quote={quote}
      alert={alert}
      onPress={() => router.push(`/stock/${stock.ticker}?name=${stock.name}`)}
      onLongPress={handleLongPress}
      onEdit={handleEdit}
      onDelete={handleDelete}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { stocks } = useStocksStore();
  const { getAlert } = useAlertStore();
  const [alertEvent, setAlertEvent] = useState<AlertEvent | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // 알림 체크용 quote 수집 — useMemo로 참조 안정화 (매 렌더 중복 실행 방지)
  const quotes = useMemo(
    () =>
      stocks.map((s) => ({
        name: s.name,
        quote: queryClient.getQueryData<any>(['quote', s.ticker]),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stocks, queryClient]
  );

  useAlertCheck(quotes, setAlertEvent);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['quote'] });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <SafeAreaView style={styles.container}>
      <OfflineBanner />
      <InAppAlert event={alertEvent} onDismiss={() => setAlertEvent(null)} />

      <View style={styles.header}>
        <Text style={styles.title}>Stock Watcher</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Ionicons name="refresh" size={22} color="#c8caff" />
        </TouchableOpacity>
      </View>

      <PortfolioSummaryCard />

      <FlatList
        data={stocks}
        keyExtractor={(item) => item.ticker}
        renderItem={({ item }) => <StockCardWrapper stock={item} />}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#c8caff" />}
      />

      {/* + FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => router.push('/add-stock')}>
        <Ionicons name="add" size={28} color="#ffffff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  list: { paddingHorizontal: 16, paddingBottom: 100 },
  fab: {
    position: 'absolute', bottom: 24, right: 24,
    backgroundColor: '#5b9bd5', width: 56, height: 56,
    borderRadius: 28, justifyContent: 'center', alignItems: 'center',
    elevation: 4,
  },
});
