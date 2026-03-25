import { getCardStatus, getCardColors } from '../../src/utils/cardStyle';

describe('getCardStatus', () => {
  it('현재가 >= 목표가 → target', () => {
    expect(getCardStatus(100, 100, 80)).toBe('target');
    expect(getCardStatus(110, 100, 80)).toBe('target');
  });
  it('현재가 <= 손절가 → stoploss', () => {
    expect(getCardStatus(80, 100, 80)).toBe('stoploss');
    expect(getCardStatus(75, 100, 80)).toBe('stoploss');
  });
  it('정상 범위 → normal', () => {
    expect(getCardStatus(90, 100, 80)).toBe('normal');
  });
  it('목표가 우선 (target > stoploss)', () => {
    expect(getCardStatus(100, 100, 100)).toBe('target');
  });
});

describe('getCardColors', () => {
  it('target → 빨간 테두리 #FF1744', () => {
    expect(getCardColors('target').border).toBe('#FF1744');
  });
  it('stoploss → 파란 테두리 #2979FF', () => {
    expect(getCardColors('stoploss').border).toBe('#2979FF');
  });
  it('normal → 네이비 테두리 #1c1f33', () => {
    expect(getCardColors('normal').border).toBe('#1c1f33');
  });
});
