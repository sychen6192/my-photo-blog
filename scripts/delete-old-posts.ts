/**
 * 一次性清理:刪除舊的 `post` 文件(已遷移到 album.photos[],這些是孤兒資料)。
 * 刪除前已備份於 backups/old-posts-2026-06-07.json。
 *
 * 執行方式:
 *   npx sanity exec scripts/delete-old-posts.ts --with-user-token
 *
 * 跑完確認無誤後,這個檔案可以刪除。
 */
import { getCliClient } from 'sanity/cli';

const client = getCliClient({ apiVersion: '2024-01-01' });

async function main() {
  // 含 published 與 drafts
  const ids: string[] = await client.fetch(`*[_type == "post"]._id`);
  if (ids.length === 0) {
    console.log('沒有要刪的 post。');
    return;
  }
  console.log(`找到 ${ids.length} 筆 post,開始刪除…`);
  let tx = client.transaction();
  for (const id of ids) tx = tx.delete(id);
  await tx.commit();
  console.log(`✅ 已刪除 ${ids.length} 筆 post。`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
