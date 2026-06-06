/// <reference types="@cloudflare/workers-types" />
import { parseExifBuffer, type ExifFields } from '../../src/sanity/lib/exif';

export interface Env {
  BUCKET: R2Bucket;
  /** 可選:逗號分隔的允許來源;未設則回應 "*"。 */
  ALLOWED_ORIGINS?: string;
}

/** EXIF 通常在 JPEG 檔頭前段;讀 128KB 足夠且省流量。 */
const HEADER_BYTES = 128 * 1024;
const IMAGE_RE = /\.(jpe?g)$/i;

interface PhotoResult extends ExifFields {
  filename: string;
}

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowList = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const allowOrigin = allowList.length === 0 ? '*' : allowList.includes(origin) ? origin : allowList[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function json(body: unknown, req: Request, env: Env, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(req, env) },
  });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const cors = corsHeaders(req, env);

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    const url = new URL(req.url);
    if (url.pathname !== '/import') {
      return json({ error: 'Not found' }, req, env, 404);
    }

    const prefix = url.searchParams.get('prefix') ?? '';
    if (!prefix) {
      return json({ error: 'prefix query parameter is required' }, req, env, 400);
    }

    const photos: PhotoResult[] = [];
    let cursor: string | undefined;

    try {
      do {
        const listing = await env.BUCKET.list({ prefix, cursor, limit: 1000 });
        for (const obj of listing.objects) {
          // 跳過資料夾標記與非影像檔
          if (obj.key.endsWith('/') || !IMAGE_RE.test(obj.key)) continue;

          let fields: ExifFields = {};
          try {
            const got = await env.BUCKET.get(obj.key, { range: { offset: 0, length: HEADER_BYTES } });
            if (got) {
              fields = await parseExifBuffer(await got.arrayBuffer());
            }
          } catch {
            // EXIF 解析失敗仍收錄該檔(只是沒帶 camera/lens/exif)
          }
          photos.push({ filename: obj.key, ...fields });
        }
        cursor = listing.truncated ? listing.cursor : undefined;
      } while (cursor);
    } catch (err) {
      return json({ error: err instanceof Error ? err.message : 'R2 list failed' }, req, env, 500);
    }

    photos.sort((a, b) => a.filename.localeCompare(b.filename));
    return json({ photos }, req, env);
  },
};
