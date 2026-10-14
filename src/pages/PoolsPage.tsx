import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { POOLS, type PoolMeta } from '../pools';
import type { PoolSettings } from '../types';

const GROUPS: { id: PoolMeta['group']; title: string; note?: string }[] = [
  { id: 'cefr', title: 'Seviyeler (CEFR)' },
  {
    id: 'exam',
    title: 'Sınavlar',
    note: 'YÖKDİL ve YDS için resmî kelime listesi yoktur; bu havuzlar sınavlarda sık geçen alan kelimelerinden derlenmiştir.',
  },
];

interface TileStats {
  settings?: PoolSettings;
  learning: number;
  known: number;
  addedToday: number;
}

/**
 * Kutucuklar kelime listelerini indirmez: toplam sayı katalogda, ilerleme veritabanındaki kararlarda.
 * Böylece sayfa ilk ziyarette de ağ beklemeden açılır.
 */
export function PoolsPage({ today }: { today: string }) {
  const stats = useLiveQuery(async () => {
    const [settings, decisions] = await Promise.all([db.poolSettings.toArray(), db.poolDecisions.toArray()]);
    const map = new Map<string, TileStats>();
    const get = (id: string) => map.get(id) ?? (map.set(id, { learning: 0, known: 0, addedToday: 0 }), map.get(id)!);
    for (const s of settings) get(s.poolId).settings = s;
    for (const d of decisions) {
      const t = get(d.poolId);
      if (d.decision === 'known') t.known++;
      else {
        t.learning++;
        if (d.date === today) t.addedToday++;
      }
    }
    return map;
  }, [today]);

  return (
    <>
      <p className="muted">
        Bir havuz seç, günde kaç yeni kelime öğrenmek istediğini belirle. Kelimeler karışık gelir: bildiklerini geç,
        öğrenmek istediklerin kartlarına eklenir ve tekrar takvimine girer.
      </p>
      {GROUPS.map((g) => (
        <section key={g.id}>
          <h2>{g.title}</h2>
          {g.note && <p className="muted small">{g.note}</p>}
          <div className="pool-grid">
            {POOLS.filter((p) => p.group === g.id).map((p) => (
              <PoolTile key={p.id} pool={p} stats={stats?.get(p.id)} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function PoolTile({ pool, stats }: { pool: PoolMeta; stats?: TileStats }) {
  const settings = stats?.settings;
  const learning = stats?.learning ?? 0;
  const known = stats?.known ?? 0;
  const doneToday = settings && (stats?.addedToday ?? 0) >= settings.dailyGoal;

  return (
    <a className="card pool-tile" href={`#/havuz/${pool.id}`}>
      <span className="pool-name">{pool.name}</span>
      <span className="muted small">{pool.description}</span>
      <span className="pool-bar" aria-hidden>
        <span className="learn" style={{ width: `${(learning / pool.size) * 100}%` }} />
        <span className="known" style={{ width: `${(known / pool.size) * 100}%` }} />
      </span>
      <span className="small">
        {pool.size} kelime
        {settings && (
          <>
            {' '}
            · öğreniliyor {learning} · biliniyor {known}
          </>
        )}
      </span>
      {settings ? (
        <span className={`small ${doneToday ? 'ok' : ''}`}>
          Bugün {stats?.addedToday ?? 0} / {settings.dailyGoal} {doneToday && '✓'}
        </span>
      ) : (
        <span className="small ok">Başla →</span>
      )}
    </a>
  );
}
