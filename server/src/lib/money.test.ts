import { describe, expect, it } from 'vitest';
import { applyPermille, formatLYD, formatLYDWithCurrency, lineTotal, parseLYD } from './money.js';

describe('parseLYD', () => {
  it('parses whole and fractional amounts to milli-LYD', () => {
    expect(parseLYD('0')).toBe(0);
    expect(parseLYD('12')).toBe(12_000);
    expect(parseLYD('12.5')).toBe(12_500);
    expect(parseLYD('12.505')).toBe(12_505);
    expect(parseLYD('0.001')).toBe(1);
    expect(parseLYD('-3.250')).toBe(-3_250);
  });

  it('rejects malformed input', () => {
    for (const bad of ['', 'abc', '1.2345', '1,000', '1.2.3', 'NaN']) {
      expect(() => parseLYD(bad), bad).toThrow(TypeError);
    }
  });
});

describe('formatLYD', () => {
  it('always shows exactly 3 decimals with thousands separators', () => {
    expect(formatLYD(0)).toBe('0.000');
    expect(formatLYD(1)).toBe('0.001');
    expect(formatLYD(12_505)).toBe('12.505');
    expect(formatLYD(1_067_750)).toBe('1,067.750');
    expect(formatLYD(1_234_567_890)).toBe('1,234,567.890');
    expect(formatLYD(-3_250)).toBe('-3.250');
  });

  it('appends the currency suffix', () => {
    expect(formatLYDWithCurrency(1_067_750)).toBe('1,067.750 د.ل');
  });

  it('rejects non-integer amounts', () => {
    expect(() => formatLYD(1.5)).toThrow(TypeError);
  });
});

describe('round-trip', () => {
  it('parse(format(x)) === x for amounts without separators', () => {
    for (const millis of [0, 1, 999, 1_000, 12_505, 999_999]) {
      expect(parseLYD(formatLYD(millis))).toBe(millis);
    }
  });
});

describe('lineTotal', () => {
  it('multiplies integer unit price by integer quantity', () => {
    expect(lineTotal(45_250, 3)).toBe(135_750);
    expect(lineTotal(45_250, 0)).toBe(0);
  });

  it('rejects fractional or negative quantities', () => {
    expect(() => lineTotal(45_250, 1.5)).toThrow(TypeError);
    expect(() => lineTotal(45_250, -1)).toThrow(TypeError);
  });
});

describe('applyPermille', () => {
  it('applies a permille rate with correct rounding (13‰ = 1.3%)', () => {
    expect(applyPermille(100_000, 13)).toBe(1_300);
    expect(applyPermille(1_000, 13)).toBe(13);
    // 0.500 rounds away from zero
    expect(applyPermille(500, 1)).toBe(1);
    expect(applyPermille(-500, 1)).toBe(-1);
    expect(applyPermille(100_000, 0)).toBe(0);
  });
});
