import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '../db';
import { buildPreview, type ParsedRow } from '../importParse';
import { addCards, getExistingTerms } from '../repo';

interface Props {
  rows: readonly ParsedRow[];
  today: string;
  onRemove: (line: number) => void;
  onSaved: (count: number) => void;
}

/** Toplu eklemede kaydetmeden önceki önizleme. Hatalı satırlar kaydedilmez; tekrar edenler uyarılır. */
export function ImportPreview({ rows, today, onRemove, onSaved }: Props) {
  const existing = useLiveQuery(() => getExistingTerms(db), []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => (existing ? buildPreview(rows, existing) : []), [rows, existing]);
  const valid = preview.filter((r) => !r.error);
  const errorCount = preview.length - valid.length;
  const warnCount = preview.filter((r) => r.warning).length;

  if (rows.length === 0) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await addCards(db, valid, today);
      onSaved(valid.length);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card">
      <h2>Önizleme</h2>
      <p>
        <strong>{preview.length}</strong> kart algılandı
        {errorCount > 0 && <span className="error-text"> · {errorCount} hatalı satır (kaydedilmeyecek)</span>}
        {warnCount > 0 && <span style={{ color: 'var(--warn)' }}> · {warnCount} tekrar eden kelime</span>}
      </p>
      <div className="table-wrap">
        <table className="preview">
          <thead>
            <tr>
              <th>#</th>
              <th>İngilizce</th>
              <th>Türkçe</th>
              <th>Örnek</th>
              <th aria-label="Sil" />
            </tr>
          </thead>
          <tbody>
            {preview.map((r) => (
              <tr key={r.line} className={r.error ? 'row-error' : r.warning ? 'row-warn' : undefined}>
                <td className="muted">{r.line}</td>
                <td>
                  {r.term}
                  {(r.error || r.warning) && <span className="note">{r.error ?? r.warning}</span>}
                </td>
                <td>{r.definition}</td>
                <td className="muted">{r.example}</td>
                <td>
                  <button type="button" className="icon" title="Satırı sil" aria-label={`${r.line}. satırı sil`} onClick={() => onRemove(r.line)}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="actions">
        <button type="button" className="primary" onClick={save} disabled={saving || valid.length === 0}>
          {valid.length} kartı kaydet
        </button>
      </div>
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
