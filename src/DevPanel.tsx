import { useState } from 'react';
import { db } from './db';
import { addCard } from './repo';
import { getSimulatedToday, setSimulatedToday } from './today';

const SAMPLE = [
  ['apple', 'elma'],
  ['book', 'kitap'],
  ['house', 'ev'],
  ['water', 'su'],
  ['tree', 'ağaç'],
];

/** Yalnızca dev modda görünür: tarih simülasyonu ve örnek veri. */
export function DevPanel({ today, onChange }: { today: string; onChange: () => void }) {
  const [simulated, setSimulated] = useState(getSimulatedToday);

  const apply = (date: string | null) => {
    setSimulatedToday(date);
    setSimulated(date);
    onChange();
  };

  return (
    <details className="dev-panel">
      <summary>Geliştirici</summary>
      <label>
        Bugünü simüle et{' '}
        <input type="date" value={simulated ?? ''} onChange={(e) => apply(e.target.value || null)} />
      </label>{' '}
      <button type="button" onClick={() => apply(null)} disabled={!simulated}>
        Gerçek tarihe dön
      </button>
      <p>
        <button
          type="button"
          onClick={async () => {
            for (const [term, definition] of SAMPLE) await addCard(db, { term, definition }, today);
          }}
        >
          {today} tarihine {SAMPLE.length} örnek kart ekle
        </button>
      </p>
    </details>
  );
}
