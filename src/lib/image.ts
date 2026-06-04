const R2_CDN = 'https://assets.sychen6192.org';

/**
 * 組合 Cloudflare R2 動態壓縮圖片網址
 * @param filename R2 圖片完整檔名，例如 DSCF4825.JPG
 * @param width    目標寬度
 * @param quality  壓縮品質 (預設 85)
 */
export function imgUrl(filename: string, width: number, quality = 85): string {
  return `${R2_CDN}/cdn-cgi/image/width=${width},quality=${quality},format=auto/${filename}`;
}
