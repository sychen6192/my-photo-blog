# Theme C (Cinematic Dark) + Native Lightbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the site to the "cinematic dark" look (deeper charcoal, roomier grid, refined captions) and add a click-to-enlarge lightbox with prev/next navigation on album pages.

**Architecture:** Pure Tailwind v4 class changes for the restyle (no new deps). The lightbox is a single Astro component using the browser-native `<dialog>` element plus a small bundled `<script>` (Astro bundles its TS imports). Photo data is passed to the client via an inline `<script type="application/json">`. The only non-trivial logic — index wrap-around for prev/next — is a pure function with a unit test.

**Tech Stack:** Astro 6 (static), Tailwind v4, native `<dialog>`, Vitest. Images via existing `imgUrl()` (Cloudflare R2 resize).

**Spec:** `docs/superpowers/specs/2026-06-07-theme-c-lightbox-design.md`

---

## File Structure

- `src/lib/lightbox.ts` — new: `wrapIndex(i, len)` pure helper (testable).
- `src/lib/lightbox.test.ts` — new: tests for `wrapIndex`.
- `src/components/Lightbox.astro` — new: native `<dialog>` markup + client script.
- `src/layouts/Layout.astro` — modify: body background → charcoal.
- `src/pages/index.astro` — modify: album-card grid restyle (theme C).
- `src/pages/albums/[slug].astro` — modify: photo-wall restyle, photo cells become lightbox triggers, emit photo JSON, include `<Lightbox />`.

---

### Task 1: `wrapIndex` pure helper

**Files:**
- Create: `src/lib/lightbox.ts`
- Test: `src/lib/lightbox.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/lightbox.test.ts`:
```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/lightbox.test.ts`
Expected: FAIL — cannot resolve `./lightbox`.

- [ ] **Step 3: Implement**

Create `src/lib/lightbox.ts`:
```ts
/** 把任意索引收斂到 [0, len) 區間,負數與超界都循環(wrap-around)。len<=0 時回傳 0。 */
export function wrapIndex(i: number, len: number): number {
  if (len <= 0) return 0;
  return ((i % len) + len) % len;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/lightbox.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lightbox.ts src/lib/lightbox.test.ts
git commit -m "feat: wrapIndex helper for lightbox prev/next"
```

---

### Task 2: Theme C base — Layout + index cards

**Files:**
- Modify: `src/layouts/Layout.astro`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Charcoal background**

In `src/layouts/Layout.astro`, change the body class:
```
<body class="bg-neutral-950 text-neutral-200 antialiased">
```
to:
```
<body class="bg-[#16181c] text-neutral-200 antialiased">
```

- [ ] **Step 2: Restyle the album-card grid**

In `src/pages/index.astro`, replace the grid opening + anchor:
```astro
      <div class="grid grid-cols-1 gap-px px-px sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <a
            href={`/albums/${album.slug.current}`}
            class="group relative block overflow-hidden bg-neutral-900"
          >
```
with:
```astro
      <div class="grid grid-cols-1 gap-3.5 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {albums.map((album) => (
          <a
            href={`/albums/${album.slug.current}`}
            class="group relative block overflow-hidden rounded-md bg-neutral-900"
          >
```

- [ ] **Step 3: Restyle the cover image filter**

In the same file, change the cover `<img>` class:
```
                  class="h-full w-full object-cover brightness-90 transition duration-500 group-hover:scale-[1.03] group-hover:brightness-100"
```
to:
```
                  class="h-full w-full object-cover contrast-[1.05] saturate-[.92] transition duration-500 group-hover:scale-[1.03]"
```

- [ ] **Step 4: Verify build + type-check**

Run: `npm run build && npm run astro check`
Expected: build completes (4 pages); `astro check` reports only the 2 pre-existing `Cannot find module 'sanity:client'` errors, no new ones.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Layout.astro src/pages/index.astro
git commit -m "feat: theme C charcoal background + restyled album cards"
```

---

### Task 3: Album-page restyle + Lightbox component

**Files:**
- Create: `src/components/Lightbox.astro`
- Modify: `src/pages/albums/[slug].astro`

- [ ] **Step 1: Create the Lightbox component**

Create `src/components/Lightbox.astro`:
```astro
---
// 原生 <dialog> 燈箱。照片資料由相簿頁輸出的 #lightbox-data JSON script 提供。
---
<dialog
  id="lightbox"
  class="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 text-neutral-100 backdrop:bg-black/85"
>
  <div id="lb-stage" class="flex h-full w-full items-center justify-center p-4 sm:p-10">
    <button id="lb-close" type="button" aria-label="關閉"
      class="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl text-white transition hover:bg-white/20">✕</button>
    <button id="lb-prev" type="button" aria-label="上一張"
      class="absolute left-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:left-6">‹</button>
    <button id="lb-next" type="button" aria-label="下一張"
      class="absolute right-2 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-2xl text-white transition hover:bg-white/20 sm:right-6">›</button>
    <figure id="lb-figure" class="m-0 flex max-h-full flex-col items-center">
      <img id="lb-img" alt="" class="max-h-[82vh] max-w-full rounded object-contain" />
      <figcaption class="mt-3 text-center">
        <p id="lb-title" class="text-sm text-neutral-100"></p>
        <p id="lb-exif" class="mt-1 text-xs tracking-wide text-neutral-400"></p>
      </figcaption>
    </figure>
  </div>
</dialog>

<script>
  import { imgUrl } from '../lib/image';
  import { wrapIndex } from '../lib/lightbox';

  interface LbPhoto { filename: string; title: string; exif: string; lens: string }

  const dialog = document.getElementById('lightbox') as HTMLDialogElement | null;
  const dataEl = document.getElementById('lightbox-data');
  if (dialog && dataEl) {
    const photos: LbPhoto[] = JSON.parse(dataEl.textContent || '[]');
    const imgEl = document.getElementById('lb-img') as HTMLImageElement;
    const titleEl = document.getElementById('lb-title') as HTMLElement;
    const exifEl = document.getElementById('lb-exif') as HTMLElement;
    const stage = document.getElementById('lb-stage') as HTMLElement;
    const figure = document.getElementById('lb-figure') as HTMLElement;
    let current = 0;

    const render = () => {
      const p = photos[current];
      if (!p) return;
      imgEl.src = imgUrl(p.filename, 1600);
      imgEl.alt = p.title;
      titleEl.textContent = p.title;
      exifEl.textContent = [p.exif, p.lens].filter(Boolean).join('  ·  ');
    };
    const open = (i: number) => {
      current = wrapIndex(i, photos.length);
      render();
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = 'hidden';
    };
    const step = (d: number) => { current = wrapIndex(current + d, photos.length); render(); };

    document.querySelectorAll<HTMLElement>('[data-lightbox-index]').forEach((el) => {
      el.addEventListener('click', () => open(Number(el.dataset.lightboxIndex)));
    });
    document.getElementById('lb-close')!.addEventListener('click', () => dialog.close());
    document.getElementById('lb-prev')!.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    document.getElementById('lb-next')!.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    figure.addEventListener('click', (e) => e.stopPropagation());
    stage.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
    });
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; });
  }
</script>
```

- [ ] **Step 2: Restyle the photo wall and make cells lightbox triggers**

In `src/pages/albums/[slug].astro`, replace the photos grid block:
```astro
      <div class="grid grid-cols-1 gap-px px-px sm:grid-cols-2 lg:grid-cols-3">
        {album.photos.map((photo) => (
          <article class="group relative overflow-hidden bg-neutral-900">
            <div class="aspect-[3/2] overflow-hidden">
              <img
                src={imgUrl(photo.filename, 800)}
                srcset={`${imgUrl(photo.filename, 400)} 400w, ${imgUrl(photo.filename, 800)} 800w, ${imgUrl(photo.filename, 1200)} 1200w`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                alt={photo.title ?? ''}
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover brightness-90 transition duration-500 group-hover:scale-[1.03] group-hover:brightness-100"
              />
            </div>
            {(photo.title || photo.exif || photo.lens) && (
              <div class="bg-gradient-to-b from-neutral-900 to-neutral-950 px-4 pb-4 pt-3.5">
                {photo.title && (
                  <h2 class="truncate text-sm font-normal text-neutral-200">{photo.title}</h2>
                )}
                {photo.exif && (
                  <p class="mt-1 text-[0.72rem] tracking-wide text-neutral-500">{photo.exif}</p>
                )}
                {photo.lens && (
                  <p class="mt-0.5 text-[0.7rem] tracking-wide text-neutral-600">{photo.lens}</p>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
```
with:
```astro
      <div class="grid grid-cols-1 gap-3.5 p-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {album.photos.map((photo, i) => (
          <button
            type="button"
            data-lightbox-index={i}
            class="group block w-full cursor-zoom-in overflow-hidden rounded-md bg-neutral-900 text-left"
          >
            <div class="aspect-[3/2] overflow-hidden">
              <img
                src={imgUrl(photo.filename, 800)}
                srcset={`${imgUrl(photo.filename, 400)} 400w, ${imgUrl(photo.filename, 800)} 800w, ${imgUrl(photo.filename, 1200)} 1200w`}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                alt={photo.title ?? ''}
                loading="lazy"
                decoding="async"
                class="h-full w-full object-cover contrast-[1.05] saturate-[.92] transition duration-500 group-hover:scale-[1.03]"
              />
            </div>
            {(photo.title || photo.exif || photo.lens) && (
              <div class="px-3.5 pb-4 pt-3">
                {photo.title && (
                  <h2 class="truncate text-sm font-normal tracking-tight text-neutral-200">{photo.title}</h2>
                )}
                {photo.exif && (
                  <p class="mt-1 text-[0.72rem] tracking-wide text-neutral-500">{photo.exif}</p>
                )}
                {photo.lens && (
                  <p class="mt-0.5 text-[0.7rem] tracking-wide text-neutral-600">{photo.lens}</p>
                )}
              </div>
            )}
          </button>
        ))}
      </div>
```

- [ ] **Step 3: Add the photo-data JSON and include the Lightbox**

In `src/pages/albums/[slug].astro`, add the import at the top of the frontmatter (after the existing `imgUrl` import):
```astro
import Lightbox from '../../components/Lightbox.astro';
```

Then, immediately before the closing `</main>` tag, insert:
```astro
    <script type="application/json" id="lightbox-data" set:html={JSON.stringify(
      album.photos.map((p) => ({ filename: p.filename, title: p.title ?? '', exif: p.exif ?? '', lens: p.lens ?? '' }))
    )} />
    <Lightbox />
```

- [ ] **Step 4: Verify build, type-check, and unit tests**

Run: `npm run build && npm run astro check && npm run test`
Expected: build completes (4 pages incl. both album pages); `astro check` shows only the 2 pre-existing `sanity:client` errors; all unit tests pass (including `wrapIndex`).

- [ ] **Step 5: Verify the lightbox bundled into the page**

Run: `grep -rl "lb-stage\|lightbox-data" dist/albums/tottori/index.html`
Expected: the file matches (the dialog markup + JSON data are present in the built album page).

- [ ] **Step 6: Commit**

```bash
git add src/components/Lightbox.astro src/pages/albums/[slug].astro
git commit -m "feat: native dialog lightbox with prev/next on album pages"
```

---

## Manual verification (after Task 3)

Run `npm run preview` (or `npm run dev`) and open an album page:
- [ ] Page background is charcoal `#16181c`; photo wall has gaps + rounded corners; images look richer (not dimmed); titles show.
- [ ] Clicking a photo opens the full-screen viewer with the large image + title/EXIF.
- [ ] `◀` / `▶` buttons and keyboard `←` / `→` move between photos and wrap around at the ends.
- [ ] `Esc`, the `✕` button, and clicking the dark background all close it; the page behind cannot scroll while it's open.
- [ ] Home page cards share the same rounded/spaced/richer look; clicking a card still navigates into the album (not the lightbox).
