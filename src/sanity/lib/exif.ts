import exifr from 'exifr';

export const R2_BASE = 'https://assets.sychen6192.org';

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
 * 從 R2 抓某個檔名的 EXIF 並格式化。exifr 接受 URL,會以分段(range)讀取檔頭,
 * 不會下載整張原圖。需 R2 公開讀取 + CORS 允許 Studio 網域。
 */
export async function fetchExifFields(filename: string): Promise<ExifFields> {
  const url = `${R2_BASE}/${encodeURIComponent(filename)}`;
  const exif = await exifr.parse(url, {
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
