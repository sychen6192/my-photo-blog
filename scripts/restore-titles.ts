/**
 * 一次性遷移:把舊 `post` 文件的手寫標題,依「R2 檔名」對回新的
 * `album.photos[].title`。只填「目前沒有標題」的照片,不覆蓋既有標題。
 *
 * 執行方式(需先 `npx sanity login` 一次):
 *   npx sanity exec scripts/restore-titles.ts --with-user-token
 *
 * 跑完確認無誤後,這個檔案可以刪除。
 */
import { getCliClient } from 'sanity/cli';

const client = getCliClient({ apiVersion: '2024-01-01' });

interface OldPost {
  coverImage?: string;
  title?: string;
}
interface AlbumPhoto {
  _key: string;
  filename?: string;
  title?: string;
}
interface AlbumDoc {
  _id: string;
  title?: string;
  photos?: AlbumPhoto[];
}

async function main() {
  // 1. 舊 post 的 檔名 -> 標題 對照表
  const posts: OldPost[] = await client.fetch(
    `*[_type == "post" && defined(coverImage) && defined(title)]{ coverImage, title }`
  );
  const titleByFile = new Map<string, string>();
  for (const p of posts) {
    if (p.coverImage && p.title) titleByFile.set(p.coverImage, p.title);
  }
  console.log(`舊 post 標題對照:${titleByFile.size} 筆`);

  // 2. 逐相簿,把沒有標題、且檔名能對到舊標題的照片補上
  const albums: AlbumDoc[] = await client.fetch(
    `*[_type == "album"]{ _id, title, photos[]{ _key, filename, title } }`
  );

  let patched = 0;
  let skippedNoMatch = 0;
  let skippedHasTitle = 0;

  for (const album of albums) {
    const tx = client.transaction();
    let any = false;

    for (const photo of album.photos ?? []) {
      if (photo.title) {
        skippedHasTitle++;
        continue;
      }
      const t = photo.filename ? titleByFile.get(photo.filename) : undefined;
      if (!t) {
        skippedNoMatch++;
        continue;
      }
      tx.patch(album._id, (p) => p.set({ [`photos[_key=="${photo._key}"].title`]: t }));
      any = true;
      patched++;
    }

    if (any) {
      await tx.commit();
      console.log(`  相簿「${album.title ?? album._id}」已更新`);
    }
  }

  console.log(
    `\n完成:補上 ${patched} 個標題;已有標題略過 ${skippedHasTitle};無對應舊標題略過 ${skippedNoMatch}`
  );
}

main().catch((err) => {
  console.error('遷移失敗:', err);
  process.exit(1);
});
