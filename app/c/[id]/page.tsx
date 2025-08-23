import { dbClient } from '@/lib/db/client';
import { s3Client } from '@/lib/storage/s3';
import { loadConfig } from '@/lib/config';

let inited = false;
async function ensureInitialized() {
  if (!inited) {
    const cfg = loadConfig();
    try { await dbClient.initialize(cfg.database); } catch {}
    try { s3Client.initialize(cfg.s3); } catch {}
    inited = true;
  }
}

// 保证动态渲染，避免被预渲染/缓存
export const dynamic = 'force-dynamic';

// Next.js 15: params 是 Promise，需要 await 解构
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  await ensureInitialized();

  const pool = dbClient.getPool();
  const { rows } = await pool.query(
    `SELECT
       id,
       model,
       scraped_at        AS "scrapedAt",
       content_key       AS "contentKey",
       source_html_bytes AS "sourceHtmlBytes",
       views,
       created_at        AS "createdAt"
     FROM conversations
     WHERE id = $1`,
    [id]
  );

  if (rows.length === 0) {
    return (
      <main style={{ padding: 32, fontFamily: 'system-ui' }}>
        <h2>Not found</h2>
        <p>Conversation <code>{id}</code> does not exist.</p>
      </main>
    );
  }

  const rec = rows[0] as {
    id: string;
    model: string;
    scrapedAt: string;
    contentKey: string;
    sourceHtmlBytes: number;
    views: number;
    createdAt: string;
  };

  const signed = await s3Client.getSignedReadUrl(rec.contentKey, 300);
  const res = await fetch(signed);
  const html = await res.text();

  // 异步 +1 浏览量（不阻塞渲染）
  pool.query('UPDATE conversations SET views = views + 1 WHERE id = $1', [id]).catch(() => {});

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '24px', fontFamily: 'system-ui' }}>
      <header style={{ marginBottom: 16, color: '#666' }}>
        <div>Model: <b>{rec.model}</b></div>
        <div>Scraped: {new Date(rec.scrapedAt).toLocaleString()}</div>
        <div>Views: {rec.views}</div>
      </header>
      <article dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
