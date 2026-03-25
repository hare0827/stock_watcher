// src/components/InAppAlert.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertEvent } from '../types';
import { formatCurrency } from '../utils/format';

interface Props {
  event: AlertEvent | null;
  onDismiss: () => void;
}

export function InAppAlert({ event, onDismiss }: Props) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (!event) return;
    Animated.sequence([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      Animated.delay(3000),
      Animated.timing(translateY, { toValue: -100, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss());
  }, [event]);

  if (!event) return null;

  const isTarget = event.type === 'target';
  const color = isTarget ? '#FF1744' : '#2979FF';
  const emoji = isTarget ? '🔴' : '🔵';
  const label = isTarget ? '목표가 도달' : '손절가 이탈';

  return (
    <Animated.View style={[styles.banner, { borderLeftColor: color, transform: [{ translateY }] }]}>
      <TouchableOpacity onPress={onDismiss} style={styles.inner}>
        <Text style={styles.title}>{emoji} {event.stock.name} — {label}</Text>
        <Text style={styles.price}>{formatCurrency(event.price, event.stock.ticker)}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999,
    backgroundColor: '#1c1f33', borderLeftWidth: 4, padding: 16,
  },
  inner: {},
  title: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  price: { color: '#c8caff', fontSize: 12, marginTop: 2 },
});
