import fetch from 'node-fetch';

const BASE_URL =
  process.env.KIS_IS_PAPER === 'true'
    ? 'https://openapivts.koreainvestment.com:29443'
    : 'https://openapi.koreainvestment.com:9443';

interface TokenCache {
  accessToken: string;
  expiresAt: number; // ms timestamp
}

let tokenCache: TokenCache | null = null;

export function clearTokenCache(): void {
  tokenCache = null;
}

export async function getToken(): Promise<string> {
  const now = Date.now();
  if (tokenCache && tokenCache.expiresAt - 10 * 60 * 1000 > now) {
    return tokenCache.accessToken;
  }

  const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: process.env.KIS_APP_KEY,
      appsecret: process.env.KIS_APP_SECRET,
    }),
  });

  if (!res.ok) throw new Error(`KIS token error: ${res.status}`);

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in * 1000,
  };
  return tokenCache.accessToken;
}

export function getBaseUrl(): string {
  return BASE_URL;
}
