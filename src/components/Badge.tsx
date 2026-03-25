// src/components/Badge.tsx
import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CardStatus } from '../types';

const BADGE_CONFIG: Record<CardStatus, { emoji: string; label: string; color: string }> = {
  target:   { emoji: '🔴', label: '목표가 도달', color: '#FF1744' },
  stoploss: { emoji: '🔵', label: '손절가 이탈', color: '#2979FF' },
  normal:   { emoji: '⚪', label: '관망',       color: '#888888' },
};

export function Badge({ status }: { status: CardStatus }) {
  const cfg = BADGE_CONFIG[status];
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: cfg.color }]}>
        {cfg.emoji} {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  text: { fontSize: 12, fontWeight: '600' },
});
