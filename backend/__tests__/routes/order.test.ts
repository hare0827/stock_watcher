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
