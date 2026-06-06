import React, { useState, useCallback } from 'react';
import { insert, setIfMissing } from 'sanity';
import type { ArrayOfObjectsInputProps } from 'sanity';
import { DEFAULT_IMPORTER_URL, IMPORTER_URL_STORAGE_KEY } from '../lib/config';
import type { ExifFields } from '../lib/exif';

interface PhotoResult extends ExifFields {
  filename: string;
}

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

function readStoredUrl(): string {
  if (typeof localStorage === 'undefined') return DEFAULT_IMPORTER_URL;
  return localStorage.getItem(IMPORTER_URL_STORAGE_KEY) ?? DEFAULT_IMPORTER_URL;
}

export function BatchPhotoInput(props: ArrayOfObjectsInputProps) {
  const { onChange, renderDefault } = props;

  const [importerUrl, setImporterUrl] = useState(readStoredUrl);
  const [prefix, setPrefix] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<string[]>([]);

  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setImporterUrl(val);
    if (typeof localStorage !== 'undefined') localStorage.setItem(IMPORTER_URL_STORAGE_KEY, val);
  }, []);

  const handleImport = useCallback(async () => {
    const base = importerUrl.trim().replace(/\/$/, '');
    const p = prefix.trim();
    if (!base) {
      setLog(['⚠️ 請先填入 Importer Worker 網址']);
      return;
    }
    if (!p) {
      setLog(['⚠️ 請填入資料夾 prefix,例如 tottori/']);
      return;
    }

    setBusy(true);
    setLog([`列出 ${p} 底下的照片…`]);

    try {
      const res = await fetch(`${base}/import?prefix=${encodeURIComponent(p)}`);
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${detail}`.trim());
      }
      const data = (await res.json()) as { photos?: PhotoResult[] };
      const photos = data.photos ?? [];

      if (photos.length === 0) {
        setLog((l) => [...l, `找不到任何照片(prefix: ${p})`]);
        return;
      }

      const newItems = photos.map((photo) => {
        const item: Record<string, unknown> = { _key: crypto.randomUUID(), _type: 'photo', filename: photo.filename };
        if (photo.camera) item.camera = photo.camera;
        if (photo.lens) item.lens = photo.lens;
        if (photo.exif) item.exif = photo.exif;
        return item;
      });

      onChange([setIfMissing([]), insert(newItems, 'after', [-1])]);

      const withExif = photos.filter((ph) => ph.exif).length;
      setLog((l) => [...l, `✅ 匯入 ${photos.length} 張(其中 ${withExif} 張帶到 EXIF)`]);
    } catch (err) {
      setLog((l) => [...l, `❌ 匯入失敗 — ${err instanceof Error ? err.message : '未知錯誤'}`]);
    } finally {
      setBusy(false);
    }
  }, [importerUrl, prefix, onChange]);

  return (
    <div>
      <div style={boxStyle}>
        <label style={{ fontSize: 12, color: 'var(--card-muted-fg-color, #aaa)' }}>
          Importer Worker 網址
          <input
            style={{ ...inputStyle, width: '100%', marginTop: 4 }}
            value={importerUrl}
            onChange={handleUrlChange}
            placeholder="https://my-photo-blog-importer.xxx.workers.dev"
          />
        </label>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
            placeholder="資料夾 prefix,例如 tottori/"
          />
          <button
            type="button"
            onClick={handleImport}
            disabled={busy}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: busy ? '#444' : '#2276fc',
              color: '#fff',
              fontSize: 13,
              cursor: busy ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {busy ? '匯入中…' : '⚡ 列出並匯入整個資料夾'}
          </button>
        </div>

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
