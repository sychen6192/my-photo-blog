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
