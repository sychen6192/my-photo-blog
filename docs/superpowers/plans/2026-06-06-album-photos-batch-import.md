# Album Photos Array + Batch Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-photo `post` documents with a `photos[]` array on each `album`, and add a Studio batch-import control that fetches EXIF for many filenames at once — eliminating per-photo creation, the manual EXIF button, and the unused slug field.

**Architecture:** Two phases. **Phase 1 is purely additive** — add the `photos` array schema + batch-import component while leaving `post` and all existing data untouched. The user then manually re-imports the ~20 photos into the 2 albums and verifies the built site. **Phase 2 (only after that verification)** switches the page queries to read `album.photos[]` and deletes the now-dead `post` type, `ExifAutoFetcher`, slug, and content. Old data stays as a live backup until the user deletes it.

**Tech Stack:** Astro 6 (static), Sanity v5 Studio (React custom input), `exifr` for EXIF, Tailwind v4. Pure helpers tested with Vitest (Vite 7 already present).

**Spec:** `docs/superpowers/specs/2026-06-06-album-photos-batch-import-design.md`

---

## File Structure

**Phase 1 — new files (additive):**
- `src/sanity/lib/filenames.ts` — pure filename helpers (range expansion, list parsing).
- `src/sanity/lib/filenames.test.ts` — tests for the above.
- `src/sanity/lib/exif.ts` — EXIF fetch + pure formatting helpers (moved out of `ExifAutoFetcher`).
- `src/sanity/lib/exif.test.ts` — tests for the pure formatting (`formatExif` and friends).
- `src/sanity/components/BatchPhotoInput.tsx` — custom array input for `album.photos`.
- `vitest.config.ts` — minimal Vitest config.

**Phase 1 — modified:**
- `src/sanity/schemaTypes/album.ts` — add `photos[]` array (with `photo` object member) wired to `BatchPhotoInput`; make `coverImage` optional.
- `package.json` — add `vitest` devDependency + `test` script.

**Phase 2 — modified:**
- `src/pages/index.astro` — query `count(photos)` + `coalesce` cover fallback.
- `src/pages/albums/[slug].astro` — read `album.photos[]` instead of the `references()` subquery.
- `src/sanity/schemaTypes/index.ts` — drop `post` from `schemaTypes`.
- `CLAUDE.md` — update data-model and component description.

**Phase 2 — deleted:**
- `src/sanity/schemaTypes/post.ts`
- `src/sanity/components/ExifAutoFetcher.tsx`

---

# Phase 1 — Additive (nothing existing is removed)

### Task 1: Vitest setup + filename helpers

**Files:**
- Create: `vitest.config.ts`
- Create: `src/sanity/lib/filenames.ts`
- Test: `src/sanity/lib/filenames.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Add Vitest dev dependency and test script**

Run:
```bash
npm install -D vitest
```

Then edit `package.json` `scripts` to add a `test` line (place it after `"astro": "astro",`):
```json
    "test": "vitest run",
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Write the failing tests**

Create `src/sanity/lib/filenames.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { expandRange, parseFilenameList } from './filenames';

describe('expandRange', () => {
  it('expands an inclusive numeric range with the extension', () => {
    expect(expandRange('DSCF', '4825', '4827', '.JPG')).toEqual([
      'DSCF4825.JPG',
      'DSCF4826.JPG',
      'DSCF4827.JPG',
    ]);
  });

  it('zero-pads to the width of the start number and accepts ext without a dot', () => {
    expect(expandRange('IMG_', '0008', '0010', 'JPG')).toEqual([
      'IMG_0008.JPG',
      'IMG_0009.JPG',
      'IMG_0010.JPG',
    ]);
  });

  it('returns empty when end is before start or inputs are not numeric', () => {
    expect(expandRange('DSCF', '4827', '4825', '.JPG')).toEqual([]);
    expect(expandRange('DSCF', '', '4827', '.JPG')).toEqual([]);
    expect(expandRange('DSCF', 'ab', 'cd', '.JPG')).toEqual([]);
  });
});

describe('parseFilenameList', () => {
  it('splits on newlines, trims, and drops blank lines', () => {
    expect(parseFilenameList('  DSCF4825.JPG \n\nDSCF4826.JPG\n  ')).toEqual([
      'DSCF4825.JPG',
      'DSCF4826.JPG',
    ]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/sanity/lib/filenames.test.ts`
Expected: FAIL — `Failed to resolve import "./filenames"` (file does not exist yet).

- [ ] **Step 5: Implement the helpers**

Create `src/sanity/lib/filenames.ts`:
```ts
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/sanity/lib/filenames.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/sanity/lib/filenames.ts src/sanity/lib/filenames.test.ts
git commit -m "feat: vitest setup + filename range/list helpers"
```

---

### Task 2: EXIF helpers (pure formatting + fetch)

**Files:**
- Create: `src/sanity/lib/exif.ts`
- Test: `src/sanity/lib/exif.test.ts`

This moves the formatting logic out of `ExifAutoFetcher.tsx` into a reusable module. `ExifAutoFetcher.tsx` is left in place for Phase 1 (still used by `post`); it is deleted in Phase 2.

- [ ] **Step 1: Write the failing tests for the pure formatter**

Create `src/sanity/lib/exif.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { formatExif, formatFocalLength, formatAperture, formatShutter } from './exif';

describe('format helpers', () => {
  it('applies Fujifilm 1.5x crop when no 35mm value is present', () => {
    expect(formatFocalLength(35)).toBe('53mm'); // round(35 * 1.5) = 53
  });
  it('prefers an explicit 35mm-equivalent focal length', () => {
    expect(formatFocalLength(35, 50)).toBe('50mm');
  });
  it('formats aperture with no decimal for whole stops', () => {
    expect(formatAperture(2)).toBe('f/2');
    expect(formatAperture(2.8)).toBe('f/2.8');
  });
  it('formats sub-second shutter as a reciprocal', () => {
    expect(formatShutter(0.004)).toBe('1/250s');
    expect(formatShutter(2)).toBe('2s');
  });
});

describe('formatExif', () => {
  it('returns an empty object for null exif', () => {
    expect(formatExif(null)).toEqual({});
  });

  it('builds camera/lens/exif strings and strips the make from the model', () => {
    expect(
      formatExif({
        Make: 'FUJIFILM',
        Model: 'FUJIFILM X-T50',
        LensModel: 'XF16-55mmF2.8 R LM WR II',
        FocalLength: 35,
        FNumber: 2.8,
        ExposureTime: 0.004,
        ISO: 400,
      })
    ).toEqual({
      camera: 'FUJIFILM X-T50',
      lens: 'XF16-55mmF2.8 R LM WR II',
      exif: '53mm, f/2.8, 1/250s, ISO 400',
    });
  });

  it('omits fields that are absent', () => {
    expect(formatExif({ Make: 'FUJIFILM', Model: 'X-T50' })).toEqual({
      camera: 'FUJIFILM X-T50',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/sanity/lib/exif.test.ts`
Expected: FAIL — cannot resolve `./exif`.

- [ ] **Step 3: Implement the EXIF module**

Create `src/sanity/lib/exif.ts`:
```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/sanity/lib/exif.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sanity/lib/exif.ts src/sanity/lib/exif.test.ts
git commit -m "feat: extract reusable EXIF fetch + format helpers"
```

---

### Task 3: Add `photos[]` array to the album schema

**Files:**
- Modify: `src/sanity/schemaTypes/album.ts`

Keeps everything that exists; adds the array and makes `coverImage` optional. The `components: { input: BatchPhotoInput }` line references the component built in Task 4 — add the import now; the build/Studio check happens after Task 4.

- [ ] **Step 1: Rewrite `album.ts` with the photos array**

Replace the entire contents of `src/sanity/schemaTypes/album.ts` with:
```ts
import { defineType, defineField, defineArrayMember } from 'sanity';
import { BatchPhotoInput } from '../components/BatchPhotoInput';

export const album = defineType({
  name: 'album',
  title: '旅程相簿',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: '相簿名稱',
      type: 'string',
      description: '例如:伊豆行、大山行',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: '網址路徑 (Slug)',
      type: 'slug',
      options: { source: 'title', maxLength: 96 },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'coverImage',
      title: 'R2 封面圖片檔名(選填,留空用第一張照片)',
      type: 'string',
      description: '例如:DSCF4825.JPG',
    }),
    defineField({
      name: 'description',
      title: '旅程簡介',
      type: 'array',
      of: [{ type: 'block' }],
    }),
    defineField({
      name: 'photos',
      title: '照片',
      type: 'array',
      components: { input: BatchPhotoInput },
      of: [
        defineArrayMember({
          type: 'object',
          name: 'photo',
          fields: [
            defineField({ name: 'filename', title: 'R2 檔名', type: 'string', validation: (Rule) => Rule.required() }),
            defineField({ name: 'title', title: '說明', type: 'string' }),
            defineField({ name: 'camera', title: '相機', type: 'string', readOnly: true }),
            defineField({ name: 'lens', title: '鏡頭', type: 'string', readOnly: true }),
            defineField({ name: 'exif', title: 'EXIF', type: 'string', readOnly: true }),
          ],
          preview: {
            select: { title: 'filename', subtitle: 'exif' },
          },
        }),
      ],
    }),
  ],
  preview: {
    select: { title: 'title', subtitle: 'slug.current' },
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add src/sanity/schemaTypes/album.ts
git commit -m "feat: add photos[] array to album schema, make coverImage optional"
```

> Note: `npm run astro check` will fail until Task 4 creates `BatchPhotoInput`. That is expected — verify together at the end of Task 4.

---

### Task 4: Build the batch-import custom array input

**Files:**
- Create: `src/sanity/components/BatchPhotoInput.tsx`

This renders a batch-add panel above Sanity's default array UI. It expands a Fujifilm range OR a pasted list, fetches EXIF per file (errors don't abort the rest), and appends `photo` items.

- [ ] **Step 1: Create the component**

Create `src/sanity/components/BatchPhotoInput.tsx`:
```tsx
import React, { useState, useCallback } from 'react';
import { insert, setIfMissing } from 'sanity';
import type { ArrayOfObjectsInputProps } from 'sanity';
import { fetchExifFields } from '../lib/exif';
import { expandRange, parseFilenameList } from '../lib/filenames';

type Mode = 'range' | 'list';

const boxStyle: React.CSSProperties = {
  border: '1px solid var(--card-border-color, #333)',
  borderRadius: 6,
  padding: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginBottom: 12,
};

const inputStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: 4,
  border: '1px solid var(--card-border-color, #333)',
  background: 'var(--card-bg-color, #1a1a1a)',
  color: 'var(--card-fg-color, #fff)',
  fontSize: 14,
};

export function BatchPhotoInput(props: ArrayOfObjectsInputProps) {
  const { onChange, renderDefault } = props;

  const [mode, setMode] = useState<Mode>('range');
  const [prefix, setPrefix] = useState('DSCF');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [ext, setExt] = useState('.JPG');
  const [listText, setListText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleImport = useCallback(async () => {
    const filenames =
      mode === 'range'
        ? expandRange(prefix.trim(), start.trim(), end.trim(), ext.trim())
        : parseFilenameList(listText);

    if (filenames.length === 0) {
      setLog(['⚠️ 沒有可匯入的檔名']);
      return;
    }

    setBusy(true);
    setLog([`開始匯入 ${filenames.length} 張…`]);

    const newItems: Record<string, unknown>[] = [];
    for (const filename of filenames) {
      try {
        const fields = await fetchExifFields(filename);
        const item: Record<string, unknown> = { _key: crypto.randomUUID(), _type: 'photo', filename };
        if (fields.camera) item.camera = fields.camera;
        if (fields.lens) item.lens = fields.lens;
        if (fields.exif) item.exif = fields.exif;
        newItems.push(item);
        setLog((l) => [...l, `✅ ${filename}`]);
      } catch (err) {
        setLog((l) => [...l, `❌ ${filename} — ${err instanceof Error ? err.message : '抓取失敗'}`]);
      }
    }

    if (newItems.length > 0) {
      onChange([setIfMissing([]), insert(newItems, 'after', [-1])]);
    }
    setLog((l) => [...l, `完成:成功 ${newItems.length} / ${filenames.length}`]);
    setBusy(false);
  }, [mode, prefix, start, end, ext, listText, onChange]);

  return (
    <div>
      <div style={boxStyle}>
        <div style={{ display: 'flex', gap: 12, fontSize: 13 }}>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" checked={mode === 'range'} onChange={() => setMode('range')} /> 連號範圍
          </label>
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" checked={mode === 'list'} onChange={() => setMode('list')} /> 貼檔名清單
          </label>
        </div>

        {mode === 'range' ? (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <input style={{ ...inputStyle, width: 80 }} value={prefix} onChange={(e) => setPrefix(e.target.value)} placeholder="前綴" />
            <input style={{ ...inputStyle, width: 90 }} value={start} onChange={(e) => setStart(e.target.value)} placeholder="起 4825" />
            <span style={{ alignSelf: 'center' }}>–</span>
            <input style={{ ...inputStyle, width: 90 }} value={end} onChange={(e) => setEnd(e.target.value)} placeholder="迄 4840" />
            <input style={{ ...inputStyle, width: 70 }} value={ext} onChange={(e) => setExt(e.target.value)} placeholder=".JPG" />
          </div>
        ) : (
          <textarea
            style={{ ...inputStyle, minHeight: 90, fontFamily: 'monospace' }}
            value={listText}
            onChange={(e) => setListText(e.target.value)}
            placeholder={'一行一個檔名\nDSCF4825.JPG\nDSCF4826.JPG'}
          />
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={busy}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: 4,
            border: 'none',
            background: busy ? '#444' : '#2276fc',
            color: '#fff',
            fontSize: 13,
            cursor: busy ? 'not-allowed' : 'pointer',
          }}
        >
          {busy ? '抓取中…' : '⚡ 抓取 EXIF 並加入'}
        </button>

        {log.length > 0 && (
          <div style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--card-muted-fg-color, #aaa)', maxHeight: 160, overflowY: 'auto' }}>
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {renderDefault(props)}
    </div>
  );
}
```

- [ ] **Step 2: Type-check the whole project**

Run: `npm run astro check`
Expected: PASS, 0 errors (this also covers the `album.ts` import added in Task 3).

- [ ] **Step 3: Run the full unit suite**

Run: `npm run test`
Expected: PASS (all filename + exif tests).

- [ ] **Step 4: Manual Studio smoke test**

Run: `npm run dev`, open `http://localhost:4321/admin`, open or create an album.
Verify:
- The 照片 field shows the batch panel above the (empty) array list.
- Range mode `DSCF` / `4825` / `4827` / `.JPG` → click 抓取 → three `✅` lines appear and three photo items are added with camera/lens/exif filled (assuming those files exist in R2).
- A made-up filename produces a `❌` line and does not abort the others.

> If every file errors with a network/CORS message, R2 CORS is not allowing the Studio origin — fix the bucket CORS before continuing (the old `ExifAutoFetcher` button had the same requirement).

- [ ] **Step 5: Commit**

```bash
git add src/sanity/components/BatchPhotoInput.tsx
git commit -m "feat: batch photo import custom input (range/list + per-file EXIF)"
```

---

## ⛔ Migration checkpoint (user action — not a code step)

Before Phase 2, the user does this in the browser (no token needed):

1. `npm run dev` → `/admin`. For **each of the 2 albums**, open it, use the batch panel to add that album's ~10 photo filenames, confirm camera/lens/exif populate.
2. Optionally set each album's `coverImage` (or leave blank to use the first photo).
3. Do **not** delete the old `post` documents yet.

**Pause here and confirm with the user that both albums now have their photos populated** before starting Phase 2. Phase 2 switches the live pages from `post` to `photos`; running it before migration would make album pages render empty.

---

# Phase 2 — Switch pages, then remove dead code (after migration is verified)

### Task 5: Point the album page at `photos[]`

**Files:**
- Modify: `src/pages/albums/[slug].astro`

- [ ] **Step 1: Update the data query and types**

In `src/pages/albums/[slug].astro` frontmatter, replace the `Post`/`Album` interfaces and the `album` fetch with:
```ts
interface Photo {
  filename: string;
  title?: string;
  camera?: string;
  lens?: string;
  exif?: string;
}

interface Album {
  _id: string;
  title: string;
  slug: { current: string };
  description?: any[];
  photos: Photo[];
}
```

Replace the `album` query (keep `getStaticPaths` and the `slug` param as-is) with:
```ts
const album: Album = await sanityClient.fetch(
  `*[_type == "album" && slug.current == $slug][0]{
    _id,
    title,
    slug,
    description,
    "photos": photos[]{ filename, title, camera, lens, exif }
  }`,
  { slug }
);
```

- [ ] **Step 2: Update the markup to iterate photos**

In the same file's template, replace `album.posts` with `album.photos`, and inside the map replace the `post` fields:
- `album.posts.length` → `album.photos.length` (both the count `<p>` and the empty-state check).
- `album.posts.map((post) => ...)` → `album.photos.map((photo) => ...)`.
- `imgUrl(post.coverImage, …)` → `imgUrl(photo.filename, …)` (all three occurrences in `src`/`srcset`).
- `alt={post.title}` → `alt={photo.title ?? ''}`.
- `{post.title}` → `{photo.title}` and wrap it so an empty title renders nothing: `{photo.title && (<h2 class="truncate text-sm font-normal text-neutral-200">{photo.title}</h2>)}`.
- `{post.exif && ...}` → `{photo.exif && ...}`.
- `{post.lens && ...}` → `{photo.lens && ...}`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/albums/[slug].astro
git commit -m "feat: render album page from photos[] array"
```

---

### Task 6: Update the index page count + cover fallback

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update the query, interface, and label**

In `src/pages/index.astro` frontmatter, change the `Album` interface field `postCount: number;` to `photoCount: number;`, and replace the fetch query with:
```ts
const albums: Album[] = await sanityClient.fetch(`
  *[_type == "album"] | order(_createdAt desc) {
    _id,
    title,
    slug,
    "coverImage": coalesce(coverImage, photos[0].filename),
    "photoCount": count(photos)
  }
`);
```

In the template, replace both `album.postCount` references with `album.photoCount`.

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: PASS — both album pages and the index generate without errors (this fetches the migrated data from Sanity).

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: index uses photo count + cover fallback to first photo"
```

---

### Task 7: Remove the dead `post` type and `ExifAutoFetcher`

**Files:**
- Modify: `src/sanity/schemaTypes/index.ts`
- Delete: `src/sanity/schemaTypes/post.ts`
- Delete: `src/sanity/components/ExifAutoFetcher.tsx`

> Only do this after Task 6's build passes and the user has confirmed the migrated site looks correct. Deleting the schema type does not delete the old `post` documents from the dataset — the user deletes those manually in Studio when ready.

- [ ] **Step 1: Drop `post` from the schema registry**

Replace the contents of `src/sanity/schemaTypes/index.ts` with:
```ts
import { album } from './album';

export const schemaTypes = [album];
```

- [ ] **Step 2: Delete the now-unused files**

Run:
```bash
git rm src/sanity/schemaTypes/post.ts src/sanity/components/ExifAutoFetcher.tsx
```

- [ ] **Step 3: Verify type-check and build**

Run: `npm run astro check && npm run build`
Expected: PASS, 0 errors, no remaining references to `post.ts` or `ExifAutoFetcher`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove unused post type and ExifAutoFetcher"
```

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Revise the architecture sections**

In `CLAUDE.md`:
- In "Content flow", replace the two-schema description: `album` now contains a `photos[]` array (each item: `filename`, `title`, and auto-filled `camera`/`lens`/`exif`); there is no longer a separate `post` document type or per-photo slug.
- Replace the "ExifAutoFetcher — custom Studio input" section with a "BatchPhotoInput" section: a custom array input on `album.photos` that expands a Fujifilm range or a pasted filename list, fetches EXIF per file from R2 via `src/sanity/lib/exif.ts`, and appends `photo` items. Note the EXIF/format helpers live in `src/sanity/lib/exif.ts` and filename helpers in `src/sanity/lib/filenames.ts`.
- In the page-query description, update `index.astro` to use `count(photos)` + `coalesce` cover, and `[slug].astro` to read `album.photos[]`.
- Add `npm run test` (Vitest, runs `src/**/*.test.ts`) to the Commands section.

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for album photos array model"
```

---

## Final verification

- [ ] `npm run test` → all green.
- [ ] `npm run astro check` → 0 errors.
- [ ] `npm run build` → succeeds; `dist/` has the index and one page per album.
- [ ] `npm run preview` → index shows correct per-album photo counts and covers; each album page shows its photo wall with EXIF/lens.
- [ ] In Studio, `post` no longer appears as a creatable type; albums carry their photos.
