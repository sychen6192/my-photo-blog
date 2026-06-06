# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Astro dev server at `localhost:4321` (also serves the Sanity Studio at `/admin`)
- `npm run build` — static build to `./dist/`
- `npm run preview` — preview the production build locally
- `npm run generate-types` — regenerate `worker-configuration.d.ts` from `wrangler.jsonc` (Cloudflare bindings)
- `npm run astro check` — type-check `.astro` files

No test runner or linter is configured. Node >= 22.12.0 is required.

## Architecture

A photography blog: an **Astro static site** (`output: 'static'`, fully SSG) with an **embedded Sanity Studio** as the CMS and **Cloudflare R2** as the image store. There is no runtime server — pages are generated at build time by querying Sanity, and deployed as static assets.

### Content flow
1. Content is authored in the Sanity Studio mounted at `/admin` (config in `sanity.config.ts`, also registered as an Astro integration in `astro.config.mjs`). The Sanity project ID `8zsgrbmy` / dataset `production` is hardcoded in **both** files — keep them in sync.
2. Two schema types in `src/sanity/schemaTypes/` (labels are in Traditional Chinese):
   - `album` (旅程相簿) — a travel album with `title`, `slug`, `coverImage` (an R2 filename string), and a Portable Text `description`.
   - `post` (攝影文章) — a photo, with a **reference to an album**, `coverImage` (R2 filename), `camera`/`lens`/`exif` strings, and Portable Text `content`.
3. Pages query Sanity at build time via `sanityClient` from the `sanity:client` virtual module:
   - `src/pages/index.astro` lists all albums with a per-album photo count (GROQ subquery using `references(^._id)`).
   - `src/pages/albums/[slug].astro` uses `getStaticPaths()` to pre-render one page per album, listing posts that reference it.

### Images — R2 + Cloudflare Image Resizing
Images are **not** Sanity assets. `coverImage` stores only a filename (e.g. `DSCF4825.JPG`); the actual file lives in a Cloudflare R2 bucket served at `https://assets.sychen6192.org`. `src/lib/image.ts` `imgUrl(filename, width, quality)` builds a Cloudflare on-the-fly resize URL (`/cdn-cgi/image/width=…,quality=…,format=auto/…`). Pages use it to emit responsive `srcset`s. To change the CDN host, edit `R2_CDN` in `src/lib/image.ts` (and `R2_BASE` in the Exif component below).

### ExifAutoFetcher — custom Studio input
`src/sanity/components/ExifAutoFetcher.tsx` is a React custom input mounted on the `post.coverImage` field (`components: { input: ExifAutoFetcher }`). When the editor clicks "⚡ 自動抓取 EXIF", it fetches the original image from R2 (`R2_BASE`), parses EXIF with `exifr`, and **patches the sibling `camera`/`lens`/`exif` fields on the same document** via `useClient().patch(...)`. It targets the draft id (`drafts.<id>`) and formats Fujifilm APS-C focal lengths to 35mm-equivalent (1.5× crop factor). This requires the R2 bucket to allow public read.

### Styling
Tailwind CSS v4 via the `@tailwindcss/vite` plugin (no `tailwind.config.js` — config is CSS-first). `src/styles/global.css` is just `@import "tailwindcss"` plus the typography plugin, imported in `src/layouts/Layout.astro`. The site uses a dark `neutral-950` aesthetic.

### Deployment
Built static output in `dist/` is deployed to Cloudflare via `wrangler.jsonc` (`assets.directory: ./dist`). Despite `@astrojs/cloudflare` being a dependency, the Astro config uses plain `output: 'static'` (no adapter) — the site is served as static assets, not a Worker.
