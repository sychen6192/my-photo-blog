# 設計:主題 C(電影感暗色)+ 原生 Lightbox

日期:2026-06-07
範圍:把網站外觀換成「電影感暗色」風格,並為相簿照片加上「點圖放大」的 lightbox(含上一張/下一張)。
**不在此範圍**:照片資料/匯入流程(已於前一份設計完成)、AI 自動產生說明(使用者選擇暫不做)。

## 目標

使用者在視覺預覽中選定方向 **C · 電影感暗色**:深炭灰底、圖片更大、間距更舒服、字體更精緻。並要求「點圖放大」採現代做法,且支援連續瀏覽(上一張/下一張)。

## 約束

- **不新增任何前端套件**。用 Tailwind v4 + 瀏覽器原生 `<dialog>` + 一小段 vanilla JS。
- 維持 Astro 靜態輸出(`output: 'static'`),lightbox 為 client-side script(Astro `<script>`)。
- 沿用既有的 R2 + Cloudflare 影像縮放(`imgUrl`),放大版用較大寬度。

## 視覺改動(主題 C)

**`src/layouts/Layout.astro`**
- `body` 底色由 `bg-neutral-950` → `bg-[#16181c]`(深炭灰),文字維持 `text-neutral-200`。
- 字型沿用 Inter。

**照片牆(`src/pages/albums/[slug].astro` 與首頁卡片 `src/pages/index.astro`)**
- 格線由 `gap-px`(幾乎貼著)改為 `gap-3.5` 並加外距 `p-3.5`;圖片加 `rounded-md`。
- 圖片濾鏡:移除壓暗的 `brightness-90`,改為 `contrast-[1.05] saturate-[.92]`(富士色調更沉穩);hover 維持輕微放大。
- 說明文字:標題 `tracking-tight`;exif/鏡頭用更淡的灰(`text-neutral-500/600`)+ `tracking-wide`,精緻化。
- 首頁相簿封面卡片套用同一套圓角/間距/濾鏡,風格一致。

## Lightbox 元件

新增 `src/components/Lightbox.astro`,只在相簿頁([slug])使用(照片都在相簿內;首頁是相簿封面,點擊仍是「進入相簿」)。

**結構**
- 頁面在照片牆下方輸出一個 `<dialog id="lightbox">`,內含:大圖 `<img>`、說明區(標題 + exif + 鏡頭)、關閉鈕、上一張/下一張鈕。
- 每個照片格仍是 `<button>`(可聚焦、可鍵盤操作),帶 `data-index`。照片資料以一個 `<script type="application/json" id="lightbox-data">` 內嵌(陣列:`{filename, title, exif, lens}`),避免把資料散在 DOM 屬性裡。

**行為(vanilla JS,Astro `<script>`)**
- 點某張(或鍵盤 Enter) → `dialog.showModal()`,以該 index 載入大圖。大圖網址用 `imgUrl(filename, 1600)`。
- 上一張/下一張:螢幕上的 ◀ ▶ 鈕,以及鍵盤 `ArrowLeft` / `ArrowRight`;到頭尾**循環**(wrap-around)。
- 關閉:`Esc`(原生 `<dialog>` 自帶)、點背景(`::backdrop` 區域 / 點到 dialog 本身非內容處)、關閉鈕。
- 開啟時鎖背景捲動(切換 `document.body` 的 `overflow: hidden`),關閉時還原。
- 淡入淡出:CSS 過場(`dialog[open]` + `::backdrop`)。
- 無障礙:格子用 `<button>` 取得焦點與鍵盤操作;箭頭/關閉鈕加 `aria-label`;`<dialog>` 原生提供 modal 焦點管理。

**純函式(可測)**
- 把索引循環邏輯抽成 `wrapIndex(i, len)`(回傳 `(i + len) % len`),放在 `src/lib/lightbox.ts`,用 Vitest 測 wrap-around 邊界(-1 → len-1、len → 0)。其餘 DOM 行為以手動驗證為主。

## 資料流

`[slug].astro` 取得 `album.photos[]` 後:
1. 照片牆每格輸出 `<button data-index={i}>` + `<img src={imgUrl(filename,800)} …>`(同現有 srcset)。
2. 輸出 `<script type="application/json" id="lightbox-data">` 內含 `photos.map(p => ({filename, title, exif, lens}))`。
3. 引入 `<Lightbox />` 元件(含 dialog 標記 + script)。script 讀 JSON、綁定點擊與鍵盤、用 `imgUrl(filename,1600)` 載入大圖。

`imgUrl` 維持不變(已支援帶資料夾的檔名)。

## 測試 / 驗收

- `npm run test`:`wrapIndex` 邊界(`wrapIndex(-1,3)===2`、`wrapIndex(3,3)===0`、`wrapIndex(0,3)===0`)。
- `npm run build` 成功;`npm run astro check` 不新增錯誤(既有 2 個 `sanity:client` 誤報除外)。
- 手動(`npm run preview` 或 dev):
  - 相簿頁為深炭灰、間距/圓角/濾鏡符合 C 風格;標題正常顯示。
  - 點照片開啟大圖;◀ ▶ 與鍵盤左右可切換並循環;Esc / 點背景 / 關閉鈕都能關;開啟時背景不可捲動。
  - 首頁卡片風格一致;點卡片仍進入相簿(非 lightbox)。
