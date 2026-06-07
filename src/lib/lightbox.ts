/** 把任意索引收斂到 [0, len) 區間,負數與超界都循環(wrap-around)。len<=0 時回傳 0。 */
export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}

/** 把數值夾在 [min, max] 區間內。 */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/** 兩個觸控點之間的距離(用於 pinch 縮放)。 */
export function touchDistance(
  a: { clientX: number; clientY: number },
  b: { clientX: number; clientY: number }
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * 把一段滑動分類成切換方向:
 * 回傳 -1(上一張,手指向右滑)、1(下一張,手指向左滑)、0(不算切換)。
 * 必須是「水平為主」且水平位移**超過** threshold 才算數。
 */
export function classifySwipe(dx: number, dy: number, threshold: number): number {
  if (Math.abs(dx) <= threshold || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx > 0 ? -1 : 1;
}

/**
 * 把平移量夾在縮放後可見的範圍內,避免把照片拖出畫面。
 * 以 transform-origin 置中計算:每側可移動的上限 = base * (scale - 1) / 2。
 * scale<=1(沒放大)時一律歸零置中。
 */
export function clampPan(
  tx: number,
  ty: number,
  scale: number,
  baseW: number,
  baseH: number
): { tx: number; ty: number } {
  if (scale <= 1) return { tx: 0, ty: 0 };
  const maxX = (baseW * (scale - 1)) / 2;
  const maxY = (baseH * (scale - 1)) / 2;
  return { tx: clamp(tx, -maxX, maxX), ty: clamp(ty, -maxY, maxY) };
}
