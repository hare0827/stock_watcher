import request from 'supertest';
import { app } from '../../src/index';
import * as kis from '../../src/kis';

jest.mock('../../src/kis');
const mockGetToken = kis.getToken as jest.MockedFunction<typeof kis.getToken>;

test('POST /auth/token — 토큰 발급 성공 시 { ok: true } 반환', async () => {
  mockGetToken.mockResolvedValueOnce('tok123');
  const res = await request(app).post('/auth/token');
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});

test('POST /auth/token — KIS 오류 시 500 반환', async () => {
  mockGetToken.mockRejectedValueOnce(new Error('KIS token error: 401'));
  const res = await request(app).post('/auth/token');
  expect(res.status).toBe(500);
  expect(res.body).toHaveProperty('error');
});
