import { useMemo, useState } from 'react';
import { looksLikeHeader, parseRows } from '../importParse';
import { ImportPreview } from './ImportPreview';

interface Loaded {
  name: string;
  rows: unknown[][];
}

/** Excel/CSV'den ekleme. SheetJS büyük olduğu için yalnızca dosya seçilince yüklenir. */
export function FileImport({ today }: { today: string }) {
  const [file, setFile] = useState<Loaded | null>(null);
  const [skipHeader, setSkipHeader] = useState(false);
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function onFile(f: File | undefined) {
    setError(null);
    setSaved(null);
    setRemoved(new Set());
    setFile(null);
    if (!f) return;
    try {
      const { readSpreadsheet } = await import('../spreadsheet');
      const rows = readSpreadsheet(await f.arrayBuffer(), f.name);
      if (rows.length === 0) throw new Error('Dosyada satır bulunamadı');
      setSkipHeader(looksLikeHeader(rows[0]));
      setFile({ name: f.name, rows });
    } catch (err) {
      setError(`Dosya okunamadı: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const rows = useMemo(() => {
    if (!file) return [];
    const parsed = skipHeader ? parseRows(file.rows.slice(1), 2) : parseRows(file.rows);
    return parsed.filter((r) => !removed.has(r.line));
  }, [file, skipHeader, removed]);

  return (
    <>
      <div className="card">
        <label className="field">
          <span>Dosya seç (.xlsx, .xls, .csv)</span>
          <input
            key={inputKey}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <p className="muted">1. sütun İngilizce, 2. sütun Türkçe, 3. sütun (opsiyonel) örnek cümle. Yalnızca ilk sayfa okunur.</p>
        {file && (
          <label>
            <input type="checkbox" checked={skipHeader} onChange={(e) => setSkipHeader(e.target.checked)} /> İlk satır başlık, atla
            {file.rows[0] && (
              <span className="muted"> ({file.rows[0].slice(0, 3).map(String).filter(Boolean).join(' | ')})</span>
            )}
          </label>
        )}
        {error && <p className="error-text">{error}</p>}
        {saved !== null && <p className="ok">{saved} kart eklendi.</p>}
      </div>
      <ImportPreview
        rows={rows}
        today={today}
        onRemove={(line) => setRemoved((s) => new Set(s).add(line))}
        onSaved={(n) => {
          setFile(null);
          setInputKey((k) => k + 1);
          setSaved(n);
        }}
      />
    </>
  );
}
