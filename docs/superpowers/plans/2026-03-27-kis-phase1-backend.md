# KIS 연동 Phase 1: 백엔드 + 인증

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Railway에 배포 가능한 Node.js 프록시 서버를 만들고 KIS 모의투자 토큰 발급/캐싱을 구현한다.

**Architecture:** `/backend` 폴더에 Express + TypeScript 서버. KIS 토큰은 서버 메모리에 캐싱하고 만료 10분 전 자동 갱신. 앱 코드는 건드리지 않는다.

**Tech Stack:** Node.js 20, Express 4, TypeScript 5, node-fetch 2, jest + supertest

---

## 파일 맵

| 파일 | 작업 |
|------|------|
| `backend/package.json` | 신규 |
| `backend/tsconfig.json` | 신규 |
| `backend/.env.example` | 신규 |
| `backend/.gitignore` | 신규 |
| `backend/Procfile` | 신규 (Railway 배포용) |
| `backend/src/index.ts` | 신규 — Express 서버 진입점 |
| `backend/src/kis.ts` | 신규 — KIS API 클라이언트 + 토큰 캐시 |
| `backend/src/routes/auth.ts` | 신규 — POST /auth/token |
| `backend/__tests__/kis.test.ts` | 신규 |
| `backend/__tests__/routes/auth.test.ts` | 신규 |

---

### Task 1: 백엔드 프로젝트 셋업

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/.env.example`
- Create: `backend/.gitignore`
- Create: `backend/Procfile`
- Create: `backend/src/index.ts`

- [ ] **Step 1: `backend/package.json` 작성**

```json
{
  "name": "stock-watcher-backend",
  "version": "1.0.0",
  "main": "dist/index.js",
  "scripts": {
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "build": "tsc",
    "test": "jest --runInBand"
  },
  "dependencies": {
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "node-fetch": "^2.7.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.10.0",
    "@types/node-fetch": "^2.6.9",
    "@types/supertest": "^6.0.2",
    "jest": "^29.7.0",
    "supertest": "^6.3.3",
    "ts-jest": "^29.1.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.3.2"
  },
  "jest": {
    "preset": "ts-jest",
    "testEnvironment": "node",
    "testMatch": ["**/__tests__/**/*.test.ts"]
  }
}
```

- [ ] **Step 2: `backend/tsconfig.json` 작성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: 나머지 설정 파일 작성**

`backend/.env.example`:
```
KIS_APP_KEY=your_app_key_here
KIS_APP_SECRET=your_app_secret_here
KIS_ACCOUNT_NO=12345678-01
KIS_IS_PAPER=true
PORT=3000
```

`backend/.gitignore`:
```
node_modules/
dist/
.env
```

`backend/Procfile`:
```
web: node dist/index.js
```

- [ ] **Step 4: `backend/src/index.ts` 작성**

```typescript
import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth';

export const app = express();
app.use(express.json());
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
```

- [ ] **Step 5: 의존성 설치**

```bash
cd backend && npm install
```

Expected: `node_modules/` 생성됨, 에러 없음.

- [ ] **Step 6: TypeScript 빌드 확인**

```bash
cd backend && npm run build
```

Expected: `dist/` 폴더 생성, 에러 없음.

- [ ] **Step 7: 커밋**

```bash
git add backend/
git commit -m "feat: add backend project scaffold"
```

---

### Task 2: KIS 토큰 클라이언트

**Files:**
- Create: `backend/src/kis.ts`
- Test: `backend/__tests__/kis.test.ts`

KIS 모의투자 토큰 엔드포인트:
- URL: `https://openapivts.koreainvestment.com:29443/oauth2/tokenP`
- Method: POST, Content-Type: application/json
- Body: `{ grant_type, appkey, appsecret }`
- Response: `{ access_token, expires_in: 86400 }`

- [ ] **Step 1: 실패 테스트 작성**

`backend/__tests__/kis.test.ts`:
```typescript
import fetch from 'node-fetch';
jest.mock('node-fetch');
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// getToken, clearTokenCache를 나중에 import
let getToken: () => Promise<string>;
let clearTokenCache: () => void;

beforeEach(async () => {
  jest.resetModules();
  const mod = await import('../src/kis');
  getToken = mod.getToken;
  clearTokenCache = mod.clearTokenCache;
  clearTokenCache();
});

function makeFetchResponse(body: object, ok = true) {
  return {
    ok,
    status: ok ? 200 : 401,
    json: async () => body,
  } as any;
}

test('토큰을 KIS에서 발급받아 반환한다', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({ access_token: 'tok123', expires_in: 86400 })
  );
  const token = await getToken();
  expect(token).toBe('tok123');
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('캐시된 토큰은 재발급 없이 반환한다', async () => {
  mockFetch.mockResolvedValueOnce(
    makeFetchResponse({ access_token: 'tok123', expires_in: 86400 })
  );
  await getToken();
  await getToken();
  expect(mockFetch).toHaveBeenCalledTimes(1);
});

test('KIS 오류 시 에러를 던진다', async () => {
  mockFetch.mockResolvedValueOnce(makeFetchResponse({}, false));
  await expect(getToken()).rejects.toThrow('KIS token error: 401');
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && npm test -- --testPathPattern=kis.test
```

Expected: FAIL — `Cannot find module '../src/kis'`

- [ ] **Step 3: `backend/src/kis.ts` 구현**

```typescript
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
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd backend && npm test -- --testPathPattern=kis.test
```

Expected: PASS (3/3)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/kis.ts backend/__tests__/kis.test.ts
git commit -m "feat: add KIS token client with cache"
```

---

### Task 3: POST /auth/token 라우트

**Files:**
- Create: `backend/src/routes/auth.ts`
- Modify: `backend/src/index.ts`
- Test: `backend/__tests__/routes/auth.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`backend/__tests__/routes/auth.test.ts`:
```typescript
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
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd backend && npm test -- --testPathPattern=auth.test
```

Expected: FAIL — 라우트 미구현

- [ ] **Step 3: `backend/src/routes/auth.ts` 구현**

```typescript
import { Router } from 'express';
import { getToken } from '../kis';

export const authRouter = Router();

authRouter.post('/token', async (_req, res) => {
  try {
    await getToken();
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd backend && npm test
```

Expected: PASS (5/5)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/routes/auth.ts backend/__tests__/routes/auth.test.ts
git commit -m "feat: add POST /auth/token route"
```

---

### Task 4: Railway 배포

**Files:**
- 이미 생성된 `backend/Procfile` 사용

- [ ] **Step 1: 빌드 최종 확인**

```bash
cd backend && npm run build && node dist/index.js &
sleep 1
curl http://localhost:3000/health
kill %1
```

Expected: `{"ok":true}`

- [ ] **Step 2: Railway 배포**

1. railway.app 접속 → New Project → Deploy from GitHub
2. Root Directory: `backend`
3. Environment Variables 설정:
   ```
   KIS_APP_KEY=<모의투자 앱키>
   KIS_APP_SECRET=<모의투자 시크릿>
   KIS_ACCOUNT_NO=<계좌번호 (예: 12345678-01)>
   KIS_IS_PAPER=true
   ```
4. Deploy

- [ ] **Step 3: 배포 확인**

```bash
curl https://<railway-url>/health
```

Expected: `{"ok":true}`

```bash
curl -X POST https://<railway-url>/auth/token
```

Expected: `{"ok":true}` (KIS 토큰 발급 성공)

- [ ] **Step 4: 커밋**

```bash
git add backend/
git commit -m "feat: KIS Phase 1 complete — backend auth deployed"
```
