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
