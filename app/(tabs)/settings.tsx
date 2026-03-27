// app/(tabs)/settings.tsx
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useKisStore } from '../../src/stores/kisStore';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [saved, setSaved] = useState(false);

  const { backendUrl, isConnected, setBackendUrl, testConnection } = useKisStore();
  const [kisUrl, setKisUrl] = useState('');
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('@finnhub_api_key').then((k) => {
      if (k) setApiKey(k);
    });
  }, []);

  useEffect(() => {
    if (backendUrl) setKisUrl(backendUrl);
  }, [backendUrl]);

  const handleTestConnection = async () => {
    await setBackendUrl(kisUrl.trim());
    setTesting(true);
    await testConnection();
    setTesting(false);
  };

  const handleSaveKey = async () => {
    await AsyncStorage.setItem('@finnhub_api_key', apiKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClearCache = () => {
    Alert.alert('캐시 초기화', '모든 주가 캐시를 삭제하고 새로 불러옵니다.', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => queryClient.clear(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>설정</Text>

        {/* KIS 모의투자 연동 */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>KIS 모의투자 연동</Text>
        <Text style={styles.sectionDesc}>
          Railway에 배포한 백엔드 서버 URL을 입력하세요.{'\n'}
          예: https://my-app.railway.app
        </Text>
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? '#00e676' : '#FF1744' }]} />
          <Text style={styles.statusText}>{isConnected ? '연결됨' : '미연결'}</Text>
        </View>
        <TextInput
          style={styles.input}
          value={kisUrl}
          onChangeText={setKisUrl}
          placeholder="https://..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          keyboardType="url"
        />
        <TouchableOpacity
          style={[styles.btn, testing && { opacity: 0.6 }]}
          onPress={handleTestConnection}
          disabled={testing}
        >
          <Text style={styles.btnText}>{testing ? '연결 테스트 중...' : '연결 테스트'}</Text>
        </TouchableOpacity>

        {/* API Key */}
        <Text style={styles.sectionTitle}>Finnhub API Key</Text>
        <Text style={styles.sectionDesc}>
          무료 키 발급: finnhub.io/register{'\n'}
          Quota: 60 req/min (무료 플랜)
        </Text>
        <TextInput
          style={styles.input}
          value={apiKey}
          onChangeText={setApiKey}
          placeholder="API Key 입력"
          placeholderTextColor="#555"
          secureTextEntry
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.btn} onPress={handleSaveKey}>
          <Text style={styles.btnText}>{saved ? '✓ 저장됨' : '저장'}</Text>
        </TouchableOpacity>

        {/* 캐시 초기화 */}
        <Text style={[styles.sectionTitle, { marginTop: 32 }]}>데이터 관리</Text>
        <TouchableOpacity style={[styles.btn, styles.btnDanger]} onPress={handleClearCache}>
          <Text style={styles.btnText}>캐시 초기화</Text>
        </TouchableOpacity>

        {/* 면책조항 */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerTitle}>데이터 출처 및 면책조항</Text>
          <Text style={styles.disclaimerText}>
            주가 데이터는 Finnhub (finnhub.io)에서 제공되며 15분 이상 지연될 수 있습니다.{'\n\n'}
            본 앱은 투자 조언을 제공하지 않습니다. 모든 투자 결정은 본인의 판단과 책임 하에 이루어져야 합니다.
          </Text>
        </View>

        {/* 아이콘 테스트 (개발용) */}
        <TouchableOpacity style={[styles.btn, { marginTop: 32, backgroundColor: '#1c1f33', borderWidth: 1, borderColor: '#2d3150' }]} onPress={() => router.push('/icon-test')}>
          <Text style={[styles.btnText, { color: '#888' }]}>🔧 아이콘 테스트</Text>
        </TouchableOpacity>

        {/* 앱 버전 */}
        <Text style={styles.version}>
          버전 {Constants.expoConfig?.version ?? '1.0.0'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0e1117' },
  content: { padding: 24, paddingBottom: 60 },
  title: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#c8caff', marginBottom: 6 },
  sectionDesc: { fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 18 },
  input: {
    backgroundColor: '#1c1f33', borderRadius: 10, padding: 14,
    color: '#ffffff', fontSize: 15, borderWidth: 1, borderColor: '#2d3150', marginBottom: 10,
  },
  btn: { backgroundColor: '#5b9bd5', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnDanger: { backgroundColor: '#2b0d0d', borderWidth: 1, borderColor: '#FF1744' },
  btnText: { color: '#ffffff', fontSize: 15, fontWeight: '600' },
  disclaimer: { backgroundColor: '#1c1f33', borderRadius: 12, padding: 16, marginTop: 32 },
  disclaimerTitle: { color: '#888', fontSize: 13, fontWeight: '700', marginBottom: 8 },
  disclaimerText: { color: '#666', fontSize: 12, lineHeight: 18 },
  version: { color: '#444', fontSize: 12, textAlign: 'center', marginTop: 32 },
  connectionStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { color: '#888', fontSize: 13 },
});
