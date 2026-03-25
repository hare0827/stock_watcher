// src/api/client.ts
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'https://finnhub.io/api/v1';

export const apiClient = axios.create({ baseURL: BASE_URL });

// 요청마다 AsyncStorage에서 API Key를 읽어 헤더에 주입
apiClient.interceptors.request.use(async (config) => {
  try {
    const apiKey = await AsyncStorage.getItem('@finnhub_api_key');
    if (apiKey) {
      config.headers['X-Finnhub-Token'] = apiKey;
    } else {
      console.warn('[Finnhub] API Key not set. Configure it in Settings.');
    }
  } catch (error) {
    console.error('[Finnhub] Failed to read API Key:', error);
  }
  return config;
});
