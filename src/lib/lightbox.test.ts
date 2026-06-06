import { describe, it, expect } from 'vitest';
import { wrapIndex } from './lightbox';

describe('wrapIndex', () => {
  it('leaves in-range indices unchanged', () => {
    expect(wrapIndex(0, 3)).toBe(0);
    expect(wrapIndex(2, 3)).toBe(2);
  });
  it('wraps -1 to the last index', () => {
    expect(wrapIndex(-1, 3)).toBe(2);
  });
  it('wraps len back to 0', () => {
    expect(wrapIndex(3, 3)).toBe(0);
  });
  it('handles multi-step over/underflow', () => {
    expect(wrapIndex(7, 3)).toBe(1);
    expect(wrapIndex(-4, 3)).toBe(2);
  });
  it('returns 0 for an empty list', () => {
    expect(wrapIndex(0, 0)).toBe(0);
    expect(wrapIndex(-1, 0)).toBe(0);
  });
});
