/**
 * 展開富士相機連號檔名,例如 expandRange('DSCF', '4825', '4827', '.JPG')
 * → ['DSCF4825.JPG', 'DSCF4826.JPG', 'DSCF4827.JPG']。
 * 以 start 字串的位數做零補齊;end < start 或非數字時回傳空陣列。
 */
export function expandRange(prefix: string, start: string, end: string, ext: string): string[] {
  const startNum = Number.parseInt(start, 10);
  const endNum = Number.parseInt(end, 10);
  if (!/^\d+$/.test(start) || !/^\d+$/.test(end) || Number.isNaN(startNum) || Number.isNaN(endNum) || endNum < startNum) {
    return [];
  }
  const width = start.length;
  const normExt = ext.startsWith('.') ? ext : `.${ext}`;
  const out: string[] = [];
  for (let n = startNum; n <= endNum; n++) {
    out.push(`${prefix}${String(n).padStart(width, '0')}${normExt}`);
  }
  return out;
}

/** 把多行文字拆成檔名陣列:逐行 trim、去掉空行。 */
export function parseFilenameList(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}
