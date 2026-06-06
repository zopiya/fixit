import { describe, it, expect } from 'vitest';
import { circledNumber } from '../../src/shared/utils';

describe('circledNumber', () => {
  it('returns circled digits 1-20', () => {
    expect(circledNumber(1)).toBe('①');
    expect(circledNumber(10)).toBe('⑩');
    expect(circledNumber(20)).toBe('⑳');
  });

  it('returns parenthesized number for n > 20', () => {
    expect(circledNumber(21)).toBe('(21)');
    expect(circledNumber(100)).toBe('(100)');
  });

  it('returns fallback for 0', () => {
    expect(circledNumber(0)).toBe('(0)');
  });

  it('returns fallback for negative numbers', () => {
    expect(circledNumber(-1)).toBe('(-1)');
  });
});
