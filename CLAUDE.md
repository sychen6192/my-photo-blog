# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Astro dev server at `localhost:4321` (also serves the Sanity Studio at `/admin`)
- `npm run build` — static build to `./dist/`
- `npm run preview` — preview the production build locally
- `npm run generate-types` — regenerate `worker-configuration.d.ts` from `wrangler.jsonc` (Cloudflare bindings)
- `npm run astro check` — type-check `.astro` files (note: reports 2 pre-existing `Cannot find module 'sanity:client'` errors — that virtual module only resolves at build/dev time, not under `astro check`. The build is the real gate.)
- `npm run test` — Vitest, runs the pure-logic unit tests under `src/**/*.test.ts`
- Importer Worker (see below): `npx wrangler deploy --config importer/wrangler.jsonc`; type-check with `npx tsc -p importer/tsconfig.json`

No linter is configured. Node >= 22.12.0 is required.

## Architecture

A photography blog: an **Astro static site** (`output: 'static'`, fully SSG) with an **embedded Sanity Studio** as the CMS and **Cloudflare R2** as the image store. There is no runtime server — pages are generated at build time by querying Sanity, and deployed as static assets.

### Content flow
1. Content is authored in the Sanity Studio mounted at `/admin` (config in `sanity.config.ts`, also registered as an Astro integration in `astro.config.mjs`). The Sanity project ID `8zsgrbmy` / dataset `production` is hardcoded in **both** files — keep them in sync.
2. One schema type in `src/sanity/schemaTypes/` (labels are in Traditional Chinese):
   - `album` (旅程相簿) — a travel album with `title`, `slug`, optional `coverImage` (an R2 filename; falls back to the first photo), Portable Text `description`, and a **`photos[]` array**. Each `photo` object holds `filename` (R2 key, e.g. `tottori/DSCF4825.JPG`), optional `title`, and auto-filled `camera`/`lens`/`exif` (read-only). There is **no** separate `post` document type and no per-photo slug — photos live inline on the album.
3. Pages query Sanity at build time via `sanityClient` from the `sanity:client` virtual module:
   - `src/pages/index.astro` lists all albums; photo count is `count(photos)` and the cover is `coalesce(coverImage, photos[0].filename)`.
   - `src/pages/albums/[slug].astro` uses `getStaticPaths()` to pre-render one page per album, reading `album.photos[]` directly. Captions render only when a photo has a `title`.

### Images — R2 + Cloudflare Image Resizing
Images are **not** Sanity assets. A photo's `filename` (and an album's optional `coverImage`) stores the R2 object key including its album folder (e.g. `tottori/DSCF4825.JPG`); the file lives in the `my-photo-blog-assets` R2 bucket served at `https://assets.sychen6192.org`. `src/lib/image.ts` `imgUrl(filename, width, quality)` builds a Cloudflare on-the-fly resize URL (`/cdn-cgi/image/width=…,quality=…,format=auto/…`). Pages use it to emit responsive `srcset`s. To change the CDN host, edit `R2_CDN` in `src/lib/image.ts`.

### Photo import — BatchPhotoInput + importer Worker
Photos are not uploaded through the Studio; they're already in the R2 bucket, organized into one folder per album (e.g. `tottori/`, `izu/`). To populate an album's `photos[]`, `src/sanity/components/BatchPhotoInput.tsx` (a custom array `input` on `album.photos`) takes a **folder prefix** and calls the importer Worker, then appends a `photo` item per returned file.

The browser can't list an R2 bucket and the R2 custom domain sends no CORS headers, so listing + EXIF parsing happen server-side in **`importer/`** — a standalone Cloudflare Worker bound to the `my-photo-blog-assets` R2 bucket. `GET /import?prefix=tottori/` lists objects under the prefix, reads each file's first 128 KB via a ranged `BUCKET.get`, parses EXIF, and returns `{ photos: [{ filename, camera, lens, exif }] }` with CORS headers. The Worker reuses `parseExifBuffer`/`formatExif` from `src/sanity/lib/exif.ts` (Fujifilm APS-C 1.5× crop, aperture/shutter formatting — pure functions, unit-tested). It is a separate deployment from the site (`importer/wrangler.jsonc`); its URL is baked into `src/sanity/lib/config.ts` (`DEFAULT_IMPORTER_URL`, overridable per-browser via localStorage).

EXIF/filename helpers live in `src/sanity/lib/exif.ts`; the Studio component is wired via `components: { input: BatchPhotoInput }` on the `photos` field in `album.ts`.

### Styling
Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is CSS-first). `src/styles/global.css` is just `@import "tailwindcss"` plus the typography plugin, imported in `src/layouts/Layout.astro`. The site uses a dark `neutral-950` aesthetic.

### Deployment
Built static output in `dist/` is deployed to Cloudflare via `wrangler.jsonc` (`assets.directory: ./dist`). Despite `@astrojs/cloudflare` being a dependency, the Astro config uses plain `output: 'static'` (no adapter) — the site is served as static assets, not a Worker. The importer Worker in `importer/` is a **separate** deployment (`importer/wrangler.jsonc`, deployed independently) and is only used by the Studio at authoring time — it is not part of the public site.
