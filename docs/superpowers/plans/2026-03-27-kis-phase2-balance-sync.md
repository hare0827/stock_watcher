# KIS 연동 Phase 2: 잔고 동기화

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** KIS 잔고를 앱 `holdingsStore`에 자동 동기화한다. Settings 화면에서 백엔드 URL을 입력하고 연결하면 앱 시작·포트폴리오 탭 진입 시 보유 종목이 자동으로 채워진다.

**Architecture:** 백엔드에 `GET /balance` 라우트 추가 (KIS 잔고 → `Holding[]` 변환). 앱에 `kisStore` (Zustand) + `src/api/kis.ts` 추가. Settings 화면에 KIS 연결 섹션 추가. Phase 1 백엔드가 배포된 상태에서 시작한다.

**Tech Stack:** Express (백엔드), Zustand + AsyncStorage (앱), jest-expo + @testing-library/react-native (앱 테스트)

**전제조건:** Phase 1 완료 (백엔드 배포됨, Railway URL 보유)

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `backend/src/routes/balance.ts` | 신규 — GET /balance |
| `backend/src/index.ts` | 수정 — balance 라우터 추가 |
| `backend/__tests__/routes/balance.test.ts` | 신규 |
| `src/api/kis.ts` | 신규 — 앱→백엔드 HTTP 클라이언트 |
| `src/stores/kisStore.ts` | 신규 — 백엔드 URL, 연결 상태, syncBalance |
| `app/(tabs)/settings.tsx` | 수정 — KIS 연결 섹션 추가 |
| `app/_layout.tsx` | 수정 — 앱 시작 시 syncBalance 호출 |
| `app/(tabs)/portfolio.tsx` | 수정 — 탭 포커스 시 syncBalance 호출 |
| `__tests__/stores/kisStore.test.ts` | 신규 |

---

### Task 5: GET /balance 라우트 (백엔드)

**Files:**
- Create: `backend/src/routes/balance.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/__tests__/routes/balance.test.ts`

KIS 국내주식 잔고 API:
- `GET /uapi/domestic-stock/v1/trading/inquire-balance`
- tr_id (paper): `VTTC8434R`
- 필수 쿼리: `CANO`, `ACNT_PRDT_CD`, `AFHR_FLPR_YN=N`, `OFL_YN=`, `INQR_DVSN=02`, `UNPR_DVSN=01`, `FUND_STTL_ICLD_YN=N`, `FNCG_AMT_AUTO_RDPT_YN=N`, `PRCS_DVSN=01`, `CTX_AREA_FK100=`, `CTX_AREA_NK100=`
- 응답 `output1[]`: `{ pdno, prdt_name, hldg_qty, pchs_avg_pric }`

계좌번호 파싱: `KIS_ACCOUNT_NO="12345678-01"` → `CANO="12345678"`, `ACNT_PRDT_CD="01"`

- [ ] **Step 1: 실패 테스트 작성**

`backend/__tests__/routes/balance.test.ts`:
```typescript
import request from 'supertest';
import { app } from '../../src/index';
import * as kis from '../../src/kis';
import fetch from 'node-fetch';

jest.mock('../../src/kis');
jest.mock('node-fetch');

const mockGetToken = kis.getToken as jest.MockedFunction<typeof kis.getToken>;
const mockGetBaseUrl = kis.getBaseUrl as jest.MockedFunction<typeof kis.getBaseUrl>;
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

function makeFetchResponse(body: object, ok = true) {
  return { ok, status: ok ? 200 : 400, json: async () => body } as any;
}

beforeEach(() => {
  process.env.KIS_ACCOUNT_NO = '12345678-01';
  mockGetToken.mockResolvedValue('tok123');
  mockGetBaseUrl.mockReturnValue('https://openapivts.koreainvestment.com:29443');
});

test('GET /balance — 잔고를 Holding[] 형식으로 반환한다', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({
      rt_cd: '0',
      output1: [
        { pdno: '005930', prdt_name: '삼성전자', hldg_qty: '10', pchs_avg_pric: '56000' },
        { pdno: '000660', prdt_name: 'SK하이닉스', hldg_qty: '5', pchs_avg_pric: '178000' },
      ],
    })
  );

  const res = await request(app).get('/balance');
  expect(res.status).toBe(200);
  expect(res.body.holdings).toHaveLength(2);

  const first = res.body.holdings[0];
  expect(first.ticker).toBe('005930.KS');
  expect(first.shares).toBe(10);
  expect(first.pricePerShare).toBe(56000);
  expect(first.currency).toBe('KRW');
  expect(first.type).toBe('buy');
  expect(first.id).toBe('kis_005930.KS');
});

test('GET /balance — 보유수량 0인 종목은 제외한다', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({
      rt_cd: '0',
      output1: [
        { pdno: '005930', prdt_name: '삼성전자', hldg_qty: '0', pchs_avg_pric: '56000' },
      ],
    })
  );

  const res = await request(app).get('/balance');
  expect(res.status).toBe(200);
  expect(res.body.holdings).toHaveLength(0);
});

test('GET /balance — KIS 오류 시 500 반환', async () => {
  mockFetch.mockResolvedValueOnce(makeFetchResponse({ rt_cd: '1', msg1: 'error' }, false));
  const res = await request(app).get('/balance');
  expect(res.status).toBe(500);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && npm test -- --testPathPattern=balance.test
```

Expected: FAIL — 라우트 미구현

- [ ] **Step 3: `backend/src/routes/balance.ts` 구현**

```typescript
import { Router } from 'express';
import fetch from 'node-fetch';
import { getToken, getBaseUrl } from '../kis';
import { Holding } from '../types';

export const balanceRouter = Router();

function parseAccount(): { cano: string; acntPrdtCd: string } {
  const raw = process.env.KIS_ACCOUNT_NO ?? '';
  const [cano, acntPrdtCd] = raw.split('-');
  return { cano, acntPrdtCd };
}

balanceRouter.get('/', async (_req, res) => {
  try {
    const token = await getToken();
    const { cano, acntPrdtCd } = parseAccount();
    const trId = process.env.KIS_IS_PAPER === 'true' ? 'VTTC8434R' : 'TTTC8434R';
    const appKey = process.env.KIS_APP_KEY ?? '';
    const appSecret = process.env.KIS_APP_SECRET ?? '';

    const params = new URLSearchParams({
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      AFHR_FLPR_YN: 'N',
      OFL_YN: '',
      INQR_DVSN: '02',
      UNPR_DVSN: '01',
      FUND_STTL_ICLD_YN: 'N',
      FNCG_AMT_AUTO_RDPT_YN: 'N',
      PRCS_DVSN: '01',
      CTX_AREA_FK100: '',
      CTX_AREA_NK100: '',
    });

    const kisRes = await fetch(
      `${getBaseUrl()}/uapi/domestic-stock/v1/trading/inquire-balance?${params}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: appKey,
          appsecret: appSecret,
          tr_id: trId,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    if (!kisRes.ok) throw new Error(`KIS balance error: ${kisRes.status}`);

    const data = (await kisRes.json()) as {
      rt_cd: string;
      output1: Array<{
        pdno: string;
        prdt_name: string;
        hldg_qty: string;
        pchs_avg_pric: string;
      }>;
    };

    if (data.rt_cd !== '0') throw new Error('KIS balance response error');

    const today = new Date().toISOString().slice(0, 10);

    const holdings: Holding[] = data.output1
      .filter((item) => parseInt(item.hldg_qty, 10) > 0)
      .map((item) => ({
        id: `kis_${item.pdno}.KS`,
        ticker: `${item.pdno}.KS`,
        shares: parseInt(item.hldg_qty, 10),
        pricePerShare: parseFloat(item.pchs_avg_pric),
        purchaseDate: today,
        currency: 'KRW' as const,
        type: 'buy' as const,
      }));

    res.json({ holdings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});
```

- [ ] **Step 4: `backend/src/types.ts` 작성 (백엔드 전용)**

```typescript
// backend/src/types.ts
export interface Holding {
  id: string;
  ticker: string;
  shares: number;
  pricePerShare: number;
  purchaseDate: string;
  currency: 'KRW' | 'USD';
  type: 'buy' | 'sell';
}
```

- [ ] **Step 5: `backend/src/index.ts`에 balance 라우터 추가**

```typescript
import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth';
import { balanceRouter } from './routes/balance';

export const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use('/balance', balanceRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd backend && npm test
```

Expected: PASS (8/8)

- [ ] **Step 7: 커밋 + Railway 재배포**

```bash
git add backend/
git commit -m "feat: add GET /balance route"
```

Railway는 main 브랜치 push 시 자동 재배포됨.

---

### Task 6: 앱 KIS API 클라이언트 + kisStore

**Files:**
- Create: `src/api/kis.ts`
- Create: `src/stores/kisStore.ts`
- Test: `__tests__/stores/kisStore.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`__tests__/stores/kisStore.test.ts`:
```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// fetchBalance를 mock
jest.mock('../../src/api/kis', () => ({
  fetchBalance: jest.fn(),
  testConnection: jest.fn(),
}));

import { fetchBalance, testConnection } from '../../src/api/kis';
const mockFetchBalance = fetchBalance as jest.MockedFunction<typeof fetchBalance>;
const mockTestConnection = testConnection as jest.MockedFunction<typeof testConnection>;

let useKisStore: typeof import('../../src/stores/kisStore').useKisStore;

beforeEach(async () => {
  jest.resetModules();
  const mod = await import('../../src/stores/kisStore');
  useKisStore = mod.useKisStore;
  useKisStore.getState().reset();
});

test('초기 상태: backendUrl null, isConnected false', () => {
  const state = useKisStore.getState();
  expect(state.backendUrl).toBeNull();
  expect(state.isConnected).toBe(false);
});

test('setBackendUrl이 AsyncStorage에 저장한다', async () => {
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  expect(await AsyncStorage.getItem('@kis_backend_url')).toBe('https://my.railway.app');
  expect(useKisStore.getState().backendUrl).toBe('https://my.railway.app');
});

test('testConnection 성공 시 isConnected true', async () => {
  mockTestConnection.mockResolvedValueOnce(true);
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  const ok = await useKisStore.getState().testConnection();
  expect(ok).toBe(true);
  expect(useKisStore.getState().isConnected).toBe(true);
});

test('syncBalance가 holdingsStore를 덮어쓴다', async () => {
  const mockHoldings = [{
    id: 'kis_005930.KS', ticker: '005930.KS', shares: 10,
    pricePerShare: 56000, purchaseDate: '2026-03-27', currency: 'KRW', type: 'buy',
  }];
  mockFetchBalance.mockResolvedValueOnce(mockHoldings);
  await useKisStore.getState().setBackendUrl('https://my.railway.app');
  useKisStore.setState({ isConnected: true });

  await useKisStore.getState().syncBalance();

  const { useHoldingsStore } = await import('../../src/stores/holdingsStore');
  const holdings = useHoldingsStore.getState().getHoldings('005930.KS');
  expect(holdings).toHaveLength(1);
  expect(holdings[0].shares).toBe(10);
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx jest __tests__/stores/kisStore.test.ts
```

Expected: FAIL

- [ ] **Step 3: `src/api/kis.ts` 구현**

```typescript
import { Holding } from '../types';

export async function testConnection(backendUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/auth/token`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBalance(backendUrl: string): Promise<Holding[]> {
  const res = await fetch(`${backendUrl}/balance`);
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  return data.holdings as Holding[];
}
```

- [ ] **Step 4: `src/stores/kisStore.ts` 구현**

```typescript
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { testConnection as apiTestConnection, fetchBalance } from '../api/kis';
import { useHoldingsStore } from './holdingsStore';

const BACKEND_URL_KEY = '@kis_backend_url';

interface KisState {
  backendUrl: string | null;
  isConnected: boolean;
  setBackendUrl: (url: string) => Promise<void>;
  hydrate: () => Promise<void>;
  testConnection: () => Promise<boolean>;
  syncBalance: () => Promise<void>;
  reset: () => void;
}

export const useKisStore = create<KisState>((set, get) => ({
  backendUrl: null,
  isConnected: false,

  setBackendUrl: async (url) => {
    set({ backendUrl: url });
    await AsyncStorage.setItem(BACKEND_URL_KEY, url);
  },

  hydrate: async () => {
    const url = await AsyncStorage.getItem(BACKEND_URL_KEY);
    if (url) set({ backendUrl: url });
  },

  testConnection: async () => {
    const { backendUrl } = get();
    if (!backendUrl) return false;
    const ok = await apiTestConnection(backendUrl);
    set({ isConnected: ok });
    return ok;
  },

  syncBalance: async () => {
    const { backendUrl, isConnected } = get();
    if (!backendUrl || !isConnected) return;
    try {
      const holdings = await fetchBalance(backendUrl);
      // holdingsStore 전체 교체: 기존 내역 삭제 후 KIS 내역 삽입
      const holdingsStore = useHoldingsStore.getState();
      // 기존 KIS 티커 전부 클리어
      const existingTickers = Object.keys(useHoldingsStore.getState().holdings);
      existingTickers.forEach((t) => holdingsStore.clearHoldings(t));
      // KIS 잔고 삽입
      holdings.forEach((h) => holdingsStore.addHolding(h));
    } catch {
      // 동기화 실패 시 기존 내역 유지
    }
  },

  reset: () => set({ backendUrl: null, isConnected: false }),
}));
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx jest __tests__/stores/kisStore.test.ts
```

Expected: PASS (4/4)

- [ ] **Step 6: 커밋**

```bash
git add src/api/kis.ts src/stores/kisStore.ts __tests__/stores/kisStore.test.ts
git commit -m "feat: add kisStore and KIS API client"
```

---

### Task 7: Settings 화면 KIS 연결 UI

**Files:**
- Modify: `app/(tabs)/settings.tsx`

- [ ] **Step 1: settings.tsx에 KIS 섹션 추가**

`app/(tabs)/settings.tsx` 상단 import에 추가:
```typescript
import { useKisStore } from '../../src/stores/kisStore';
```

`SettingsScreen` 컴포넌트 내부에 state 추가:
```typescript
const { backendUrl, isConnected, setBackendUrl, testConnection } = useKisStore();
const [kisUrl, setKisUrl] = useState('');
const [testing, setTesting] = useState(false);

useEffect(() => {
  if (backendUrl) setKisUrl(backendUrl);
}, [backendUrl]);

const handleTestConnection = async () => {
  await setBackendUrl(kisUrl.trim());
  setTesting(true);
  await testConnection();
  setTesting(false);
};
```

`ScrollView` 내부, Finnhub 섹션 바로 위에 추가:
```tsx
{/* KIS 연동 */}
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
```

`StyleSheet`에 추가:
```typescript
connectionStatus: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
statusText: { color: '#888', fontSize: 13 },
```

- [ ] **Step 2: 앱 실행해서 Settings 탭 확인**

```bash
npx expo start
```

Settings 탭 → KIS 섹션 보임, URL 입력 후 "연결 테스트" 탭 → 연결됨/미연결 표시 확인.

- [ ] **Step 3: 커밋**

```bash
git add app/(tabs)/settings.tsx
git commit -m "feat: add KIS connection UI in settings"
```

---

### Task 8: 앱 시작 + 포트폴리오 탭 포커스 시 잔고 동기화

**Files:**
- Modify: `app/_layout.tsx`
- Modify: `app/(tabs)/portfolio.tsx`

- [ ] **Step 1: `app/_layout.tsx`에 KIS hydrate + syncBalance 추가**

현재 `HydrationGate`의 `useEffect` 수정:
```typescript
import { useKisStore } from '../src/stores/kisStore';

function HydrationGate({ children }: { children: React.ReactNode }) {
  const { hydrate, hydrated } = useStocksStore();
  const { hydrateAlert } = useAlertStore();
  const { hydrate: hydrateHoldings } = useHoldingsStore();
  const { hydrate: hydrateKis, syncBalance } = useKisStore();

  useEffect(() => {
    hydrate().then(() => {
      const latestStocks = useStocksStore.getState().stocks;
      latestStocks.forEach((s) => hydrateAlert(s.ticker));
    });
    hydrateHoldings();
    hydrateKis().then(() => syncBalance());
  }, []);

  if (!hydrated) return null;
  return <>{children}</>;
}
```

- [ ] **Step 2: `app/(tabs)/portfolio.tsx`에 탭 포커스 시 syncBalance 추가**

현재 import 섹션에 추가:
```typescript
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useKisStore } from '../../src/stores/kisStore';
```

`PortfolioScreen` 컴포넌트 내부에 추가:
```typescript
const { syncBalance } = useKisStore();

useFocusEffect(
  useCallback(() => {
    syncBalance();
  }, [syncBalance])
);
```

- [ ] **Step 3: 통합 테스트**

1. `npx expo start`
2. Settings에서 Railway URL 입력 → 연결 테스트 → 연결됨
3. 앱 재시작 → 포트폴리오 탭에 KIS 잔고 표시 확인
4. 포트폴리오 탭을 벗어났다가 다시 진입 → 잔고 재조회 확인

- [ ] **Step 4: 전체 테스트 확인**

```bash
npx jest
```

Expected: PASS (기존 44 + 신규 tests)

- [ ] **Step 5: 커밋**

```bash
git add app/_layout.tsx app/(tabs)/portfolio.tsx
git commit -m "feat: KIS Phase 2 complete — balance sync on app start and portfolio focus"
```
