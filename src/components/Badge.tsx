// src/components/Badge.tsx
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CardStatus } from '../types';

const BADGE_CONFIG: Record<CardStatus, { label: string; color: string }> = {
  target:   { label: '목표가 도달', color: '#FF1744' },
  stoploss: { label: '손절가 이탈', color: '#2979FF' },
  normal:   { label: '관망',       color: '#888888' },
};

export function Badge({ status }: { status: CardStatus }) {
  const cfg = BADGE_CONFIG[status];
  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text style={[styles.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '600' },
});
