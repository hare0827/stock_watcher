# KIS 연동 Phase 3: 주문 실행

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 종목 상세 화면에서 KIS를 통해 직접 매수/매도 주문을 실행한다. KIS 미연결 시에는 기존 수동 입력 폼을 유지하고 KIS 주문 폼은 disabled 상태로 표시한다.

**Architecture:** 백엔드에 `POST /order`, `GET /order/:orderId` 라우트 추가. 앱 `kisStore`에 `placeOrder` 함수 추가. 종목 상세 화면(`app/stock/[ticker].tsx`)에 KIS 주문 섹션 추가 — KIS 연결 시 활성화, 미연결 시 disabled + 경고 배너.

**Tech Stack:** Express (백엔드), Zustand (앱), jest + supertest, jest-expo

**전제조건:** Phase 2 완료 (잔고 동기화 동작)

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `backend/src/routes/order.ts` | 신규 — POST /order, GET /order/:orderId |
| `backend/src/index.ts` | 수정 — order 라우터 추가 |
| `backend/__tests__/routes/order.test.ts` | 신규 |
| `src/api/kis.ts` | 수정 — placeOrder, getOrderStatus 추가 |
| `src/stores/kisStore.ts` | 수정 — placeOrder 추가 |
| `app/stock/[ticker].tsx` | 수정 — KIS 주문 섹션 추가 |
| `__tests__/components/KisOrderSection.test.tsx` | 신규 |

---

### Task 9: POST /order + GET /order/:orderId (백엔드)

**Files:**
- Create: `backend/src/routes/order.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/__tests__/routes/order.test.ts`

KIS 국내주식 주문 API:
- `POST /uapi/domestic-stock/v1/trading/order-cash`
- 매수 tr_id (paper): `VTTC0802U`
- 매도 tr_id (paper): `VTTC0801U`
- Body: `{ CANO, ACNT_PRDT_CD, PDNO, ORD_DVSN: "01" (시장가), ORD_QTY, ORD_UNPR: "0" }`
- 응답: `{ rt_cd, output: { KRX_FWDG_ORD_ORGNO, ORNO } }` — ORNO가 주문번호

KIS 주문 조회 API:
- `GET /uapi/domestic-stock/v1/trading/inquire-daily-ccld`
- tr_id (paper): `VTTC8001R`
- 응답에서 주문번호 매칭

- [ ] **Step 1: 실패 테스트 작성**

`backend/__tests__/routes/order.test.ts`:
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

test('POST /order — 매수 주문 성공 시 orderId 반환', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({ rt_cd: '0', output: { ORNO: 'ORD001', KRX_FWDG_ORD_ORGNO: '00000' } })
  );

  const res = await request(app)
    .post('/order')
    .send({ ticker: '005930.KS', shares: 5, orderType: 'buy' });

  expect(res.status).toBe(200);
  expect(res.body.orderId).toBe('ORD001');
  expect(res.body.status).toBe('accepted');
});

test('POST /order — 매도 주문 성공 시 orderId 반환', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({ rt_cd: '0', output: { ORNO: 'ORD002', KRX_FWDG_ORD_ORGNO: '00000' } })
  );

  const res = await request(app)
    .post('/order')
    .send({ ticker: '005930.KS', shares: 3, orderType: 'sell' });

  expect(res.status).toBe(200);
  expect(res.body.orderId).toBe('ORD002');
});

test('POST /order — KIS 오류 시 500 반환', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({ rt_cd: '1', msg1: '잔액 부족' }, false)
  );

  const res = await request(app)
    .post('/order')
    .send({ ticker: '005930.KS', shares: 100, orderType: 'buy' });

  expect(res.status).toBe(500);
  expect(res.body.error).toBeDefined();
});

test('GET /order/:orderId — accepted 상태 반환', async () => {
  const res = await request(app).get('/order/ORD001');
  expect(res.status).toBe(200);
  expect(res.body.status).toBe('accepted');
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && npm test -- --testPathPattern=order.test
```

Expected: FAIL

- [ ] **Step 3: `backend/src/routes/order.ts` 구현**

```typescript
import { Router } from 'express';
import fetch from 'node-fetch';
import { getToken, getBaseUrl } from '../kis';

export const orderRouter = Router();

function parseAccount() {
  const raw = process.env.KIS_ACCOUNT_NO ?? '';
  const [cano, acntPrdtCd] = raw.split('-');
  return { cano, acntPrdtCd };
}

// 티커에서 .KS 제거 → KIS PDNO 형식
function toPdno(ticker: string): string {
  return ticker.replace('.KS', '');
}

orderRouter.post('/', async (req, res) => {
  const { ticker, shares, orderType } = req.body as {
    ticker: string;
    shares: number;
    orderType: 'buy' | 'sell';
  };

  try {
    const token = await getToken();
    const { cano, acntPrdtCd } = parseAccount();
    const isPaper = process.env.KIS_IS_PAPER === 'true';
    const trId = orderType === 'buy'
      ? (isPaper ? 'VTTC0802U' : 'TTTC0802U')
      : (isPaper ? 'VTTC0801U' : 'TTTC0801U');

    const kisRes = await fetch(
      `${getBaseUrl()}/uapi/domestic-stock/v1/trading/order-cash`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          appkey: process.env.KIS_APP_KEY ?? '',
          appsecret: process.env.KIS_APP_SECRET ?? '',
          tr_id: trId,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          PDNO: toPdno(ticker),
          ORD_DVSN: '01', // 시장가
          ORD_QTY: String(shares),
          ORD_UNPR: '0',
        }),
      }
    );

    if (!kisRes.ok) throw new Error(`KIS order error: ${kisRes.status}`);

    const data = (await kisRes.json()) as {
      rt_cd: string;
      msg1?: string;
      output?: { ORNO: string; KRX_FWDG_ORD_ORGNO: string };
    };

    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'KIS order failed');

    res.json({ orderId: data.output?.ORNO ?? '', status: 'accepted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});

// 단순 상태 조회 — 현재는 accepted만 반환 (체결 조회는 별도 구현)
orderRouter.get('/:orderId', (req, res) => {
  res.json({ orderId: req.params.orderId, status: 'accepted' });
});
```

- [ ] **Step 4: `backend/src/index.ts`에 order 라우터 추가**

```typescript
import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth';
import { balanceRouter } from './routes/balance';
import { orderRouter } from './routes/order';

export const app = express();
app.use(express.json());
app.use('/auth', authRouter);
app.use('/balance', balanceRouter);
app.use('/order', orderRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd backend && npm test
```

Expected: PASS (12/12)

- [ ] **Step 6: 커밋 + Railway 재배포**

```bash
git add backend/
git commit -m "feat: add POST /order and GET /order/:orderId routes"
```

---

### Task 10: kisStore.placeOrder + src/api/kis.ts 확장

**Files:**
- Modify: `src/api/kis.ts`
- Modify: `src/stores/kisStore.ts`

- [ ] **Step 1: `src/api/kis.ts`에 placeOrder 추가**

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

export async function placeOrder(
  backendUrl: string,
  ticker: string,
  shares: number,
  orderType: 'buy' | 'sell'
): Promise<string> {
  const res = await fetch(`${backendUrl}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, shares, orderType }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? `Order failed: ${res.status}`);
  }
  const data = await res.json();
  return data.orderId as string;
}
```

- [ ] **Step 2: `src/stores/kisStore.ts`에 placeOrder 추가**

`KisState` 인터페이스에 추가:
```typescript
placeOrder: (ticker: string, shares: number, orderType: 'buy' | 'sell') => Promise<string>;
```

`kisStore.ts` 상단 import에 `placeOrder` 추가:
```typescript
import { testConnection as apiTestConnection, fetchBalance, placeOrder as apiPlaceOrder } from '../api/kis';
```

`create` 내부에 추가:
```typescript
placeOrder: async (ticker, shares, orderType) => {
  const { backendUrl, isConnected, syncBalance } = get();
  if (!backendUrl || !isConnected) throw new Error('KIS 미연결');
  const orderId = await apiPlaceOrder(backendUrl, ticker, shares, orderType);
  // 주문 후 잔고 재조회
  await syncBalance();
  return orderId;
},
```

- [ ] **Step 3: 커밋**

```bash
git add src/api/kis.ts src/stores/kisStore.ts
git commit -m "feat: add placeOrder to kisStore"
```

---

### Task 11: 종목 상세 화면 KIS 주문 UI

**Files:**
- Modify: `app/stock/[ticker].tsx`
- Test: `__tests__/components/KisOrderSection.test.tsx`

KIS 주문 섹션을 별도 컴포넌트 `KisOrderSection`으로 분리한다 (hooks-of-hooks 방지 + 테스트 용이).

- [ ] **Step 1: `src/components/KisOrderSection.tsx` 작성**

```typescript
// src/components/KisOrderSection.tsx
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
  netShares: number; // 현재 보유 순수량
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
          <Text style={styles.warningText}>⚠️  KIS 미연결 — 설정에서 연결해주세요</Text>
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
```

- [ ] **Step 2: 실패 테스트 작성**

`__tests__/components/KisOrderSection.test.tsx`:
```typescript
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { KisOrderSection } from '../../src/components/KisOrderSection';
import { useKisStore } from '../../src/stores/kisStore';

jest.mock('../../src/stores/kisStore');
const mockUseKisStore = useKisStore as jest.MockedFunction<typeof useKisStore>;

test('KIS 미연결 시 경고 배너가 표시된다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: false, placeOrder: jest.fn(),
  } as any);

  const { getByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={0} />
  );
  expect(getByText(/KIS 미연결/)).toBeTruthy();
});

test('KIS 연결 시 경고 배너가 없다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: true, placeOrder: jest.fn(),
  } as any);

  const { queryByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={10} />
  );
  expect(queryByText(/KIS 미연결/)).toBeNull();
});

test('연결 시 매수 버튼을 탭하면 모달이 열린다', () => {
  mockUseKisStore.mockReturnValue({
    isConnected: true, placeOrder: jest.fn(),
  } as any);

  const { getByText } = render(
    <KisOrderSection ticker="005930.KS" currentPrice={56000} netShares={10} />
  );
  fireEvent.press(getByText('매수'));
  expect(getByText('매수 주문 — 005930.KS')).toBeTruthy();
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
npx jest __tests__/components/KisOrderSection.test.tsx
```

Expected: FAIL

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx jest __tests__/components/KisOrderSection.test.tsx
```

Expected: PASS (3/3)

- [ ] **Step 5: `app/stock/[ticker].tsx`에 KisOrderSection 추가**

상단 import에 추가:
```typescript
import { KisOrderSection } from '../../src/components/KisOrderSection';
import { useKisStore } from '../../src/stores/kisStore';
```

컴포넌트 내부에 추가:
```typescript
const { isConnected } = useKisStore();
```

`ScrollView` 내부, `holdingsSection` View 바로 아래에 추가:
```tsx
<KisOrderSection
  ticker={ticker}
  currentPrice={quote?.currentPrice ?? null}
  netShares={netShares}
/>
```

KIS 연결 시 기존 수동 입력 버튼 숨기기 — `actionButtons` View 조건부 렌더링:
```tsx
{/* 버튼 영역 — KIS 미연결 시에만 표시 */}
{!isConnected && (
  <View style={styles.actionButtons}>
    <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
      <Ionicons name="add-circle-outline" size={18} color="#5b9bd5" />
      <Text style={styles.addButtonText}>매수 내역 추가</Text>
    </TouchableOpacity>
    {netShares > 0 && (
      <TouchableOpacity style={styles.addButton} onPress={() => setSellModalVisible(true)}>
        <Ionicons name="remove-circle-outline" size={18} color="#FF1744" />
        <Text style={[styles.addButtonText, { color: '#FF1744' }]}>매도 내역 추가</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

- [ ] **Step 6: 전체 테스트 확인**

```bash
npx jest
```

Expected: PASS (모든 테스트)

- [ ] **Step 7: 통합 테스트**

1. `npx expo start`
2. Settings에서 KIS 연결
3. 종목 상세 → KIS 주문 섹션 표시, 매수/매도 버튼 활성화 확인
4. 매수 버튼 → 수량 입력 → 확인 → 주문 완료 알림
5. 포트폴리오 탭으로 이동 → 잔고 자동 업데이트 확인
6. Settings에서 연결 해제 (URL 삭제) → 종목 상세로 이동 → 경고 배너 표시, 기존 수동 입력 버튼 표시 확인

- [ ] **Step 8: 최종 커밋**

```bash
git add src/components/KisOrderSection.tsx app/stock/[ticker].tsx \
  __tests__/components/KisOrderSection.test.tsx
git commit -m "feat: KIS Phase 3 complete — order execution UI"
```
