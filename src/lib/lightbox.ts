/** 把任意索引收斂到 [0, len) 區間,負數與超界都循環(wrap-around)。len<=0 時回傳 0。 */
export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}
