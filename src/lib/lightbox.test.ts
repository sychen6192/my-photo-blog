import { describe, it, expect } from 'vitest';
import { wrapIndex, clamp, touchDistance, classifySwipe, clampPan, isSwipeDown } from './lightbox';

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

describe('clamp', () => {
  it('returns the value when in range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it('clamps to the lower bound', () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  it('clamps to the upper bound', () => {
    expect(clamp(99, 0, 10)).toBe(10);
  });
  it('handles bounds at the edges', () => {
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });
});

describe('touchDistance', () => {
  it('measures a 3-4-5 triangle', () => {
    expect(touchDistance({ clientX: 0, clientY: 0 }, { clientX: 3, clientY: 4 })).toBe(5);
  });
  it('is zero for the same point', () => {
    expect(touchDistance({ clientX: 7, clientY: 2 }, { clientX: 7, clientY: 2 })).toBe(0);
  });
  it('is order-independent', () => {
    const a = { clientX: 1, clientY: 1 };
    const b = { clientX: 4, clientY: 5 };
    expect(touchDistance(a, b)).toBe(touchDistance(b, a));
  });
});

describe('classifySwipe', () => {
  it('returns -1 (previous) for a rightward swipe past the threshold', () => {
    expect(classifySwipe(80, 5, 50)).toBe(-1);
  });
  it('returns 1 (next) for a leftward swipe past the threshold', () => {
    expect(classifySwipe(-80, 5, 50)).toBe(1);
  });
  it('returns 0 when horizontal travel is under the threshold', () => {
    expect(classifySwipe(20, 0, 50)).toBe(0);
  });
  it('returns 0 when the gesture is mostly vertical', () => {
    expect(classifySwipe(60, 90, 50)).toBe(0);
  });
  it('returns 0 at exactly the threshold (must exceed it)', () => {
    expect(classifySwipe(50, 0, 50)).toBe(0);
  });
});

describe('isSwipeDown', () => {
  it('is true for a downward swipe past the threshold', () => {
    expect(isSwipeDown(0, 100, 80)).toBe(true);
  });
  it('is false when downward travel is under the threshold', () => {
    expect(isSwipeDown(0, 50, 80)).toBe(false);
  });
  it('is false for an upward swipe', () => {
    expect(isSwipeDown(0, -100, 80)).toBe(false);
  });
  it('is false when the gesture is mostly horizontal', () => {
    expect(isSwipeDown(120, 90, 80)).toBe(false);
  });
});

describe('clampPan', () => {
  it('pins pan to 0 when not zoomed (scale 1)', () => {
    expect(clampPan(120, -80, 1, 600, 400)).toEqual({ tx: 0, ty: 0 });
  });
  it('allows pan within the overflow at scale 2', () => {
    // overflow each side = base * (scale-1) / 2 = 600*1/2=300 (x), 400*1/2=200 (y)
    expect(clampPan(100, -50, 2, 600, 400)).toEqual({ tx: 100, ty: -50 });
  });
  it('clamps pan to the overflow edges', () => {
    expect(clampPan(9999, -9999, 2, 600, 400)).toEqual({ tx: 300, ty: -200 });
  });
});
