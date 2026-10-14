import { read, utils } from 'xlsx';

/**
 * İlk çalışma sayfasını satır dizisi olarak okur. CSV metin olarak UTF-8 çözülür
 * (aksi halde Türkçe karakterler bozulabilir); ayırıcı virgül veya noktalı virgül olabilir.
 */
export function readSpreadsheet(data: ArrayBuffer, fileName: string): unknown[][] {
  const isCsv = /\.(csv|txt)$/i.test(fileName);
  const wb = isCsv
    ? read(new TextDecoder('utf-8').decode(data).replace(/^﻿/, ''), { type: 'string', raw: true })
    : read(data, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true });
}
