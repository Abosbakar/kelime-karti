import type { Mode } from '../types';
import { MODE_LABEL, type SessionEntry } from './StudyPage';

export function SessionSummary({ mode, entries, total }: { mode: Mode; entries: SessionEntry[]; total: number }) {
  if (total === 0) {
    return (
      <div className="card">
        <h1>{MODE_LABEL[mode]}</h1>
        <p>Bugün bu modda sorulacak kart yok.</p>
        <a href="#/">Ana sayfaya dön</a>
      </div>
    );
  }

  const correct = entries.filter((e) => e.correct).length;
  const wrong = entries.length - correct;
  // Kademe yalnızca 1+ kademedeki kart bilinmediğinde düşer; 0'daki kart zaten en altta.
  const dropped = entries.filter((e) => !e.correct && e.outcome.previous.stage > 0).length;
  const unanswered = total - entries.length;
  const other: Mode = mode === 'recognition' ? 'writing' : 'recognition';

  return (
    <div className="card">
      <h1>{MODE_LABEL[mode]} — özet</h1>
      <ul className="summary">
        <li>
          <span className="ok">Doğru</span> <strong>{correct}</strong>
        </li>
        <li>
          <span className="error-text">Yanlış</span> <strong>{wrong}</strong>
        </li>
        <li>
          Kademesi düşen <strong>{dropped}</strong>
        </li>
        {unanswered > 0 && (
          <li className="muted">
            Cevaplanmayan <strong>{unanswered}</strong> (bugün tekrar çalışabilirsin)
          </li>
        )}
      </ul>
      <div className="actions">
        <a className="button primary" href="#/">
          Ana sayfa
        </a>
        <a className="button secondary" href={`#/calis/${other}`}>
          {MODE_LABEL[other]} çalış
        </a>
      </div>
    </div>
  );
}
