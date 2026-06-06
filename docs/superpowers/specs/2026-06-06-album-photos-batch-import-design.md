# 設計:相簿內建照片陣列 + 批次匯入

日期:2026-06-06(2026-06-07 修訂匯入機制)
範圍:重新設計「新增照片」工作流程,解決三個痛點中的兩個(自動帶 EXIF、批次上傳免打 slug)。
**不在此範圍**:網站主題/外觀調整(另開一輪設計)。

## 2026-06-07 修訂:改用 Importer Worker(取代瀏覽器端連號/逐檔抓取)

實作中發現兩個事實推翻了原本「瀏覽器直接抓 R2」的做法:

1. **R2 自訂網域沒有 CORS 標頭**(`curl` 驗證:檔案 HTTP 200 但無 `access-control-allow-origin`),瀏覽器跨網域 `fetch` 會被擋 → 原 `fetchExifFields` 永遠抓不到。
2. **瀏覽器無法列出 R2 資料夾內容**(列檔需憑證)。使用者真正要的是「給資料夾 prefix → 抓整個資料夾」,且實際檔名是跳號的(`4755 / 4838 / 4893`…),連號展開不適用。
3. 原圖很大(單張約 26 MB),不適合下載到瀏覽器解析。

**修訂後做法**:新增一支獨立的 Cloudflare Worker(`importer/`,綁定 R2 bucket `my-photo-blog-assets`),端點 `GET /import?prefix=<folder>/`:在伺服器端 `BUCKET.list({prefix})` 列出所有影像檔 → 對每個檔用 `BUCKET.get(key, { range })` 只讀檔頭 128KB → `parseExifBuffer()` 解析 → 回傳 `{ photos: [{filename, camera, lens, exif}] }`(帶 CORS 標頭)。

- `BatchPhotoInput` 改為:輸入 importer 網址(存 localStorage)+ 資料夾 prefix → 一鍵呼叫 Worker → 把回傳的照片附加進陣列。移除連號/逐檔 UI 與瀏覽器端 `fetchExifFields`/`r2Url`。
- `src/sanity/lib/exif.ts` 移除瀏覽器抓取(`fetchExifFields`/`r2Url`),新增 `parseExifBuffer(buffer)` 供 Worker 與既有 `formatExif` 共用。
- 部署需一次性 `wrangler login` + `wrangler deploy --config importer/wrangler.jsonc`(使用者本就用 wrangler,不需新增 app token)。
- 安全性:Worker 預設 CORS 回 `*`、端點公開可列舉 bucket;因 bucket 本就公開讀取,個人部落格可接受,日後可用 `ALLOWED_ORIGINS` env 收斂。

下方原文中「批次匯入元件」「連號範圍」相關段落以本修訂為準。

## 背景與問題

目前一張照片是一份獨立的 `post` 文件,流程為:在 Cloudflare 後台手動上傳原圖到 R2 → 進 Sanity Studio 逐篇建立 post → 手打 R2 檔名 → 逐篇按「⚡ 自動抓取 EXIF」按鈕 → 還要為每篇填一個必填 slug。

痛點:
1. **EXIF 要逐張按按鈕**。
2. **照片一篇一篇建立很慢**。
3. **每篇都要填 slug**,但經查證 `post.slug` 沒有任何頁面使用(網站只有首頁與 `/albums/[相簿slug]` 兩種頁面,沒有單張照片頁),純屬白工。`post.content` 同樣從未被任何頁面讀取。

使用者定位:每張照片就是「相片牆上的一張照片」(標題/短說明 + EXIF),不需要單張獨立文章頁。約束:**全程在瀏覽器內完成,不使用指令列或 API token**。

## 方案決策

採用「方案 A」:把 `post` 文件收進 `album`,以陣列承載照片,並提供批次匯入元件。理由:最直接解決「一張張來」,且順手移除大量死欄位(`post.content`、`post.slug`)與整個 `post` type,讓資料模型與頁面查詢都更簡單。富士相機連號檔名特別適合用範圍展開來省去打字。

## 資料模型

`album` 文件帶自己的照片陣列;`post` type 移除。

```
album {
  title        string         (必填)
  slug         slug           (必填,/albums/[slug] 路由用 — 保留)
  description  array[block]   (相簿簡介 — 保留)
  coverImage   string         (改為「選填」;留空時頁面 fallback 用 photos[0].filename)
  photos[]     array,每項為物件 type 'photo' = {
                 _key      string  (Sanity 陣列項目鍵,由元件以 crypto.randomUUID() 產生)
                 filename  string  (必填,R2 完整檔名,如 DSCF4825.JPG)
                 title     string  (選填,顯示為照片說明)
                 camera    string  (批次匯入自動帶)
                 lens      string  (批次匯入自動帶)
                 exif      string  (批次匯入自動帶)
               }
}
```

`post.ts` 連同 `content`、`slug` 欄位一併刪除。

## 批次匯入元件

掛在 `album.photos` 陣列欄位上的自訂 input 元件(取代現有 `ExifAutoFetcher`)。它在標準陣列清單上方多一塊批次新增區,提供兩種輸入(擇一):

- **貼檔名**:textarea,一行一個檔名。
- **富士連號範圍**:三個輸入 — 前綴(`DSCF`)+ 起始號(`4825`)+ 結束號(`4840`)+ 副檔名(預設 `.JPG`)。展開時以起始號的位數做零補齊(`4825`→四位),產生 `DSCF4825.JPG` … `DSCF4840.JPG`。

按「抓取並加入」後,對展開出的每個檔名:

1. 用 `exifr.parse(url, options)` 直接對 `https://assets.sychen6192.org/<filename>` 解析 — 由 exifr 自行做分段(range)讀取,**只抓檔頭、不下載整張原圖**,批次才不會慢。
2. 套用既有格式化邏輯(富士 APS-C 1.5x 等效焦距、`f/x.x` 光圈、`1/xxxs` 快門、`ISO xxx`)組出 camera / lens / exif 字串。
3. 以 `crypto.randomUUID()` 產生 `_key`,組成 photo 物件,透過 `onChange` 的 `insert`/`set` patch 追加進陣列。

逐檔顯示結果:成功幾筆、哪些檔名失敗(HTTP 404 或無 EXIF),失敗不中斷其餘。匯入後使用者仍可在陣列項目內手動編輯各張 title 或拖曳排序。

### 共用模組

把 EXIF 解析 + 格式化邏輯從原 `ExifAutoFetcher.tsx` 抽到 `src/sanity/lib/exif.ts`,匯出單一函式(輸入檔名 → 回傳 `{ camera, lens, exif }`)供批次元件呼叫。原 `ExifAutoFetcher.tsx` 移除。

## 頁面查詢調整

- `src/pages/index.astro`:相簿照片數改用 `"photoCount": count(photos)`;封面 `imgUrl(album.coverImage ?? album.photos?.[0]?.filename, …)`。移除原本對 `post` 的 `references()` 計數子查詢。
- `src/pages/albums/[slug].astro`:直接讀 `album.photos[]`(含 title/camera/lens/exif),不再用 `*[_type=="post" && references(^._id)]` 子查詢。其餘渲染(響應式 `srcset`、aspect ratio、顯示 exif/lens)維持不變。

## 清理

- 刪除 `src/sanity/schemaTypes/post.ts`。
- `src/sanity/schemaTypes/index.ts` 的 `schemaTypes` 改為 `[album]`。
- 刪除 `src/sanity/components/ExifAutoFetcher.tsx`,邏輯移入 `src/sanity/lib/exif.ts`。
- 更新 `CLAUDE.md`:資料模型由「post 參照 album」改為「album 內含 photos 陣列」,並更新批次匯入元件說明。

## 資料搬移(分階段、可回頭)

現況:約 20 篇 post、2 個相簿。搬移**不寫任何轉換腳本、不改寫舊 post 文件**——舊資料全程原封不動,作為「活的備份」,直到使用者親手刪除。實作拆兩階段:

**階段一(純新增,不破壞)**
- 新增 `album.photos` 陣列 schema 與批次匯入元件。
- **保留** `post.ts` 與 `ExifAutoFetcher`,Studio 內舊 post 仍完整可見。
- 此階段結束:新舊模型並存,網站頁面可暫時仍讀舊 post,或已切到讀 photos(見下)。

**搬移操作(使用者手動,免 token)**
- 在新工具裡,每個相簿貼上其所屬照片檔名(各約 10 個)按一次匯入,EXIF 自動重抓。共兩次操作。
- `npm run build` 後檢查兩個相簿頁照片牆正確無誤。

**階段二(確認後才清理)**
- 確認新相片牆正確 → 刪除舊 post 文件、移除 `post.ts`、`ExifAutoFetcher.tsx`、頁面對 post 的查詢。
- 任一步發現問題可停在階段一回頭,因舊資料與 post type 都還在。Sanity 另保留文件歷史作為誤刪救援。

> 注意:頁面查詢的切換(讀 post → 讀 photos)排在「搬移操作完成且驗證後」,避免階段一期間相簿頁短暫空白。

## 前置條件 / 風險

- **R2 CORS**:批次元件在瀏覽器跨網域抓 EXIF,需 R2 允許 Studio 網域。現有 `ExifAutoFetcher` 按鈕能運作即代表已設定;實作時驗證。
- **R2 原圖公開**:讀 EXIF 需 bucket 公開讀取,原圖(含 GPS)對外可下載 — 此為既有狀況,本次不改變(隱私議題另議)。
- **大陣列**:單一相簿數十張照片在 Sanity 陣列完全沒問題;旅程相簿規模不觸及上限。

## 測試 / 驗收

- 範圍展開:`DSCF` + `4825`–`4827` → 正確產生 3 個四位零補齊檔名。
- 批次匯入:貼 3 個有效檔名 → 陣列新增 3 項且 camera/lens/exif 已填;混入 1 個不存在檔名 → 該筆標示失敗、其餘 3 筆成功。
- 首頁:相簿顯示正確照片數;未填 coverImage 的相簿用第一張當封面。
- 相簿頁:照片牆正確渲染、顯示 exif/lens。
- `npm run build` 成功(SSG 取得新模型資料)、`npm run astro check` 無型別錯誤。
