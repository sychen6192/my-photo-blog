import React, { useState, useCallback } from 'react';
import { set, unset } from 'sanity';
import type { StringInputProps, PatchEvent } from 'sanity';
import { useFormValue, useClient } from 'sanity';
import exifr from 'exifr';

const R2_BASE = 'https://assets.sychen6192.org';

/**
 * 將焦距數字轉換成 35mm 等效焦距字串
 * Fujifilm APS-C crop factor = 1.5
 */
function formatFocalLength(raw: number, focalLength35mm?: number): string {
  const effective = focalLength35mm ?? Math.round(raw * 1.5);
  return `${effective}mm`;
}

function formatAperture(val: number): string {
  return `f/${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}`;
}

function formatShutter(val: number): string {
  if (val >= 1) return `${val}s`;
  const denom = Math.round(1 / val);
  return `1/${denom}s`;
}

export function ExifAutoFetcher(props: StringInputProps) {
  const { elementProps, onChange, value = '' } = props;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 取得當前 document id 以便 patch 其他欄位
  const docId = useFormValue(['_id']) as string;
  const client = useClient({ apiVersion: '2024-01-01' });

  const handleFetch = useCallback(async () => {
    const filename = value.trim();
    if (!filename) {
      setError('請先填入圖片檔名');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // 透過 Cloudflare R2 直接抓原圖（需 R2 bucket 允許 public read）
      const url = `${R2_BASE}/${filename}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: 無法取得圖片`);

      const buffer = await res.arrayBuffer();

      const exif = await exifr.parse(buffer, {
        tiff: true,
        exif: true,
        gps: false,
        interop: false,
        translateValues: true,
        translateKeys: true,
        pick: [
          'Make', 'Model',
          'LensModel', 'LensMake',
          'FocalLength', 'FocalLengthIn35mmFormat',
          'FNumber', 'ExposureTime', 'ISO',
        ],
      });

      if (!exif) throw new Error('此圖片沒有 EXIF 資料');

      // --- 組合各欄位字串 ---
      const make = (exif.Make ?? '').trim();
      const model = (exif.Model ?? '').replace(make, '').trim();
      const cameraStr = [make, model].filter(Boolean).join(' ');

      const lensStr = exif.LensModel?.trim() ?? exif.LensMake?.trim() ?? '';

      const parts: string[] = [];
      if (exif.FocalLength != null) {
        parts.push(formatFocalLength(exif.FocalLength, exif.FocalLengthIn35mmFormat));
      }
      if (exif.FNumber != null) parts.push(formatAperture(exif.FNumber));
      if (exif.ExposureTime != null) parts.push(formatShutter(exif.ExposureTime));
      if (exif.ISO != null) parts.push(`ISO ${exif.ISO}`);
      const exifStr = parts.join(', ');

      // --- Patch 同個 document 的其他欄位 ---
      // draft id 格式為 "drafts.<id>"，要同時處理
      const patchId = docId.startsWith('drafts.') ? docId : `drafts.${docId}`;

      await client
        .patch(patchId)
        .set({
          ...(cameraStr && { camera: cameraStr }),
          ...(lensStr && { lens: lensStr }),
          ...(exifStr && { exif: exifStr }),
        })
        .commit({ autoGenerateArrayKeys: true });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知錯誤');
    } finally {
      setLoading(false);
    }
  }, [value, docId, client]);

  // coverImage 欄位本身的 onChange（保持原本行為）
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      onChange(val ? set(val) : unset());
      setError(null);
      setSuccess(false);
    },
    [onChange]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          {...elementProps}
          value={value}
          onChange={handleChange}
          placeholder="例如：DSCF4825.JPG"
          style={{
            flex: 1,
            padding: '6px 10px',
            borderRadius: 4,
            border: '1px solid var(--card-border-color, #333)',
            background: 'var(--card-bg-color, #1a1a1a)',
            color: 'var(--card-fg-color, #fff)',
            fontSize: 14,
          }}
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading || !value.trim()}
          style={{
            padding: '6px 14px',
            borderRadius: 4,
            border: 'none',
            background: loading ? '#444' : '#2276fc',
            color: '#fff',
            fontSize: 13,
            cursor: loading || !value.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            opacity: !value.trim() ? 0.5 : 1,
          }}
        >
          {loading ? '讀取中…' : '⚡ 自動抓取 EXIF'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>❌ {error}</p>
      )}
      {success && (
        <p style={{ color: '#4ade80', fontSize: 12, margin: 0 }}>
          ✅ camera / lens / exif 已自動填入
        </p>
      )}
    </div>
  );
}
