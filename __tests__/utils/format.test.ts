import { isKoreanStock, formatPrice, formatCurrency } from '../../src/utils/format';

describe('isKoreanStock', () => {
  it('KS suffix를 한국 주식으로 판별', () => {
    expect(isKoreanStock('005930.KS')).toBe(true);
  });
  it('KQ suffix를 한국 주식으로 판별', () => {
    expect(isKoreanStock('247540.KQ')).toBe(true);
  });
  it('미국 주식은 false', () => {
    expect(isKoreanStock('NVDA')).toBe(false);
    expect(isKoreanStock('TSLA')).toBe(false);
  });
});

describe('formatPrice', () => {
  it('한국 주식 정수 포맷 — 소수점 없음', () => {
    const result = formatPrice(75400, '005930.KS');
    expect(result).not.toContain('.');
    expect(result.replace(/[,.\s]/g, '')).toBe('75400');
  });
  it('미국 주식 소수점 포맷', () => {
    const result = formatPrice(875.5, 'NVDA');
    expect(result).toContain('875');
    expect(result).toMatch(/[.,]5?0$/);
  });
});

describe('formatCurrency', () => {
  it('한국 주식 ₩ 접두사', () => {
    expect(formatCurrency(75400, '005930.KS')).toMatch(/^₩/);
  });
  it('미국 주식 $ 접두사', () => {
    expect(formatCurrency(875.5, 'NVDA')).toMatch(/^\$/);
  });
});
