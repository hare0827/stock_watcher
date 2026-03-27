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
