// src/components/OfflineBanner.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      setIsOffline(!state.isConnected);
    });
    return unsub;
  }, []);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>🔴 오프라인 — 캐시 데이터를 표시합니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: '#333', padding: 8, alignItems: 'center' },
  text: { color: '#ccc', fontSize: 12 },
});
