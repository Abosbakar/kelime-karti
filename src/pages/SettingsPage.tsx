import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { parseBackup, type Backup } from '../backup';
import { db } from '../db';
import { exportBackup, importBackup } from '../repo';
import { getPersistState, requestPersist, type PersistState } from '../storage';
import { getThemePref, setThemePref, type ThemePref } from '../theme';

const THEMES: [ThemePref, string][] = [
  ['system', 'Sistem'],
  ['light', 'Açık'],
  ['dark', 'Koyu'],
];

export function SettingsPage({ today }: { today: string }) {
  const [theme, setTheme] = useState(getThemePref);

  return (
    <>
      <section className="card">
        <h2>Tema</h2>
        <div className="radios" role="radiogroup" aria-label="Tema">
          {THEMES.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name="theme"
                checked={theme === value}
                onChange={() => {
                  setThemePref(value);
                  setTheme(value);
                }}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      </section>
      <BackupSection today={today} />
    </>
  );
}

function PersistInfo() {
  const [state, setState] = useState<PersistState | null>(null);
  useEffect(() => {
    getPersistState().then(setState);
  }, []);
  if (!state || state === 'unsupported') return null;
  if (state === 'persisted') return <p className="ok small">Kalıcı depolama açık: tarayıcı verileri kendiliğinden silmez.</p>;
  return (
    <p className="small">
      <span style={{ color: 'var(--warn)' }}>Kalıcı depolama kapalı:</span> yer darlığında tarayıcı verileri silebilir.{' '}
      <button type="button" className="secondary small" onClick={() => requestPersist().then(setState)}>
        İzin iste
      </button>
    </p>
  );
}

function BackupSection({ today }: { today: string }) {
  const counts = useLiveQuery(async () => ({ cards: await db.cards.count(), logs: await db.logs.count() }), []);
  const [pending, setPending] = useState<Backup | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);

  async function onExport() {
    const backup = await exportBackup(db, new Date().toISOString());
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kelime-karti-yedek-${today}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`${backup.cards.length} kart dışa aktarıldı.`);
  }

  async function onFile(file: File | undefined) {
    setPending(null);
    setErrors([]);
    setMessage(null);
    if (!file) return;
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      setErrors(['Dosya geçerli bir JSON değil']);
      return;
    }
    const r = parseBackup(data);
    if (r.ok) setPending(r.backup);
    else setErrors(r.errors);
  }

  async function onRestore() {
    if (!pending) return;
    if (!window.confirm(`Mevcut ${counts?.cards ?? 0} kart ve tüm geçmiş silinip yedekteki ${pending.cards.length} kart yüklenecek. Emin misin?`)) {
      return;
    }
    try {
      const r = await importBackup(db, pending, today);
      setMessage(
        `${pending.cards.length} kart geri yüklendi.` +
          (r.missed ? ` Yedekten bu yana geçen günlerde ${r.missed} cevapsız kontrol işlendi.` : ''),
      );
      setPending(null);
      setInputKey((k) => k + 1);
    } catch (err) {
      setErrors([`Geri yüklenemedi: ${err instanceof Error ? err.message : String(err)}`]);
    }
  }

  return (
    <section className="card">
      <h2>Yedekleme</h2>
      <p className="muted">
        Veriler yalnızca bu cihazdaki tarayıcıda saklanır. Tarayıcı verileri silinirse kartlar da gider; düzenli yedek al.
      </p>
      <PersistInfo />
      <div className="actions">
        <button type="button" className="primary" onClick={onExport} disabled={!counts?.cards}>
          Dışa aktar (JSON)
        </button>
        {counts && (
          <span className="muted">
            {counts.cards} kart, {counts.logs} cevap kaydı
          </span>
        )}
      </div>

      <label className="field" style={{ marginTop: 16 }}>
        <span>İçe aktar (yedek dosyası seç)</span>
        <input key={inputKey} type="file" accept=".json,application/json" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {pending && (
        <div className="restore-box">
          <p>
            Yedek: <strong>{pending.cards.length}</strong> kart, {pending.logs.length} cevap kaydı
            {pending.exportedAt && <span className="muted"> · {new Date(pending.exportedAt).toLocaleString('tr-TR')}</span>}
          </p>
          <p className="error-text">Geri yükleme bu cihazdaki tüm kartların yerine geçer.</p>
          <div className="actions">
            <button type="button" className="danger" onClick={onRestore}>
              Geri yükle
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setPending(null);
                setInputKey((k) => k + 1);
              }}
            >
              Vazgeç
            </button>
          </div>
        </div>
      )}
      {errors.length > 0 && (
        <ul className="error-text">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {message && <p className="ok">{message}</p>}
    </section>
  );
}
