import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useKisStore } from '../stores/kisStore';

interface Props {
  ticker: string;
  currentPrice: number | null;
  netShares: number;
}

export function KisOrderSection({ ticker, currentPrice, netShares }: Props) {
  const { isConnected, placeOrder } = useKisStore();
  const [modalType, setModalType] = useState<'buy' | 'sell' | null>(null);
  const [inputShares, setInputShares] = useState('');
  const [loading, setLoading] = useState(false);

  const estimatedAmount = currentPrice && parseInt(inputShares, 10)
    ? currentPrice * parseInt(inputShares, 10)
    : null;

  const resetModal = () => {
    setInputShares('');
    setModalType(null);
  };

  const handleOrder = async () => {
    if (!modalType) return;
    const shares = parseInt(inputShares, 10);
    if (!Number.isInteger(shares) || shares < 1) {
      Alert.alert('오류', '주수는 1 이상의 정수로 입력해주세요.');
      return;
    }
    if (modalType === 'sell' && shares > netShares) {
      Alert.alert('오류', `매도 수량(${shares}주)이 보유 수량(${netShares}주)을 초과합니다.`);
      return;
    }

    setLoading(true);
    try {
      await placeOrder(ticker, shares, modalType);
      Alert.alert('주문 완료', `${shares}주 ${modalType === 'buy' ? '매수' : '매도'} 주문이 완료됐습니다.`);
      resetModal();
    } catch (err) {
      const message = err instanceof Error ? err.message : '주문 실패';
      Alert.alert('주문 실패', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>KIS 주문</Text>

      {!isConnected && (
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>KIS 미연결 — 설정에서 연결해주세요</Text>
        </View>
      )}

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.buyBtn, !isConnected && styles.btnDisabled]}
          onPress={() => isConnected && setModalType('buy')}
          disabled={!isConnected}
        >
          <Text style={styles.btnText}>매수</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sellBtn, (!isConnected || netShares === 0) && styles.btnDisabled]}
          onPress={() => isConnected && netShares > 0 && setModalType('sell')}
          disabled={!isConnected || netShares === 0}
        >
          <Text style={styles.btnText}>매도</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={modalType !== null} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {modalType === 'buy' ? '매수' : '매도'} 주문 — {ticker}
            </Text>

            <Text style={styles.inputLabel}>
              수량{modalType === 'sell' ? ` (보유: ${netShares}주)` : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={inputShares}
              onChangeText={setInputShares}
              placeholder="예: 5"
              placeholderTextColor="#555"
              keyboardType="number-pad"
            />

            {estimatedAmount != null && (
              <Text style={styles.estimatedAmount}>
                예상 금액: {ticker.endsWith('.KS') ? '₩' : '$'}
                {estimatedAmount.toLocaleString()}
              </Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={resetModal}
                disabled={loading}
              >
                <Text style={styles.modalBtnCancelText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalBtn,
                  modalType === 'buy' ? styles.modalBtnBuy : styles.modalBtnSell,
                  loading && { opacity: 0.6 },
                ]}
                onPress={handleOrder}
                disabled={loading}
              >
                {loading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalBtnConfirmText}>확인</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#1c1f33', borderRadius: 12,
    padding: 16, marginTop: 16,
  },
  sectionTitle: { color: '#c8caff', fontWeight: '700', fontSize: 15, marginBottom: 12 },
  warningBanner: {
    backgroundColor: '#2b1500', borderRadius: 8,
    padding: 10, marginBottom: 12,
    borderWidth: 1, borderColor: '#ff6b00',
  },
  warningText: { color: '#ff9944', fontSize: 13 },
  buttons: { flexDirection: 'row', gap: 10 },
  buyBtn: {
    flex: 1, backgroundColor: '#00897b',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  sellBtn: {
    flex: 1, backgroundColor: '#c62828',
    borderRadius: 10, paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  estimatedAmount: { color: '#888', fontSize: 13, marginTop: 8 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalSheet: {
    backgroundColor: '#1c1f33', borderTopLeftRadius: 20,
    borderTopRightRadius: 20, padding: 24, paddingBottom: 36,
  },
  modalTitle: { color: '#ffffff', fontSize: 17, fontWeight: '700', marginBottom: 20 },
  inputLabel: { color: '#888', fontSize: 12, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: '#0e1117', borderRadius: 8, borderWidth: 1,
    borderColor: '#2d3150', color: '#ffffff', fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 24 },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#2d3150' },
  modalBtnCancelText: { color: '#888', fontWeight: '600' },
  modalBtnBuy: { backgroundColor: '#00897b' },
  modalBtnSell: { backgroundColor: '#c62828' },
  modalBtnConfirmText: { color: '#ffffff', fontWeight: '700' },
});
