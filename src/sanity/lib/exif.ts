import exifr from 'exifr';

export interface ExifFields {
  camera?: string;
  lens?: string;
  exif?: string;
}

const EXIF_PICK = [
  'Make', 'Model',
  'LensModel', 'LensMake',
  'FocalLength', 'FocalLengthIn35mmFormat',
  'FNumber', 'ExposureTime', 'ISO',
];

/** 富士 APS-C crop factor 1.5;有 35mm 等效值時優先採用。 */
export function formatFocalLength(raw: number, focalLength35mm?: number): string {
  const effective = focalLength35mm ?? Math.round(raw * 1.5);
  return `${effective}mm`;
}

export function formatAperture(val: number): string {
  return `f/${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}`;
}

export function formatShutter(val: number): string {
  if (val >= 1) return `${val}s`;
  const denom = Math.round(1 / val);
  return `1/${denom}s`;
}

/** 把 exifr 解析出的原始物件整理成 camera / lens / exif 顯示字串。純函式。 */
export function formatExif(exif: Record<string, any> | null | undefined): ExifFields {
  if (!exif) return {};

  const make = (exif.Make ?? '').trim();
  const model = (exif.Model ?? '').replace(make, '').trim();
  const camera = [make, model].filter(Boolean).join(' ') || undefined;

  const lens = (exif.LensModel?.trim() || exif.LensMake?.trim()) || undefined;

  const parts: string[] = [];
  if (exif.FocalLength != null) parts.push(formatFocalLength(exif.FocalLength, exif.FocalLengthIn35mmFormat));
  if (exif.FNumber != null) parts.push(formatAperture(exif.FNumber));
  if (exif.ExposureTime != null) parts.push(formatShutter(exif.ExposureTime));
  if (exif.ISO != null) parts.push(`ISO ${exif.ISO}`);
  const exifStr = parts.join(', ') || undefined;

  const out: ExifFields = {};
  if (camera) out.camera = camera;
  if (lens) out.lens = lens;
  if (exifStr) out.exif = exifStr;
  return out;
}

/**
 * 從一段影像位元組(通常是檔頭前數十 KB)解析 EXIF 並格式化。
 * 在 Cloudflare Worker 端使用:用 R2 binding 讀取檔頭 bytes 後丟進來,
 * 不需把整張原圖傳到瀏覽器,也沒有瀏覽器 CORS 問題。
 */
export async function parseExifBuffer(buffer: ArrayBuffer | Uint8Array): Promise<ExifFields> {
  const exif = await exifr.parse(buffer, {
    tiff: true,
    exif: true,
    gps: false,
    interop: false,
    translateValues: true,
    translateKeys: true,
    pick: EXIF_PICK,
  });
  return formatExif(exif);
}
