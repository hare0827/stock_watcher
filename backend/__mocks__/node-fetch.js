// Manual mock for node-fetch that uses a global singleton so the same
// mock function is returned even after jest.resetModules() clears the
// module registry. This allows top-level mockFetch references in tests
// to remain in sync with what kis.ts calls internally.
if (!global.__nodeFetchMock) {
  global.__nodeFetchMock = jest.fn();
}
const fetchMock = global.__nodeFetchMock;
fetchMock.default = fetchMock;
module.exports = fetchMock;
module.exports.default = fetchMock;
