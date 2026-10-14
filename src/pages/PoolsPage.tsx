import { POOLS, type PoolMeta } from '../pools';
import { usePoolState } from '../usePool';

const GROUPS: { id: PoolMeta['group']; title: string; note?: string }[] = [
  { id: 'cefr', title: 'Seviyeler (CEFR)' },
  {
    id: 'exam',
    title: 'Sınavlar',
    note: 'YÖKDİL ve YDS için resmî kelime listesi yoktur; bu havuzlar sınavlarda sık geçen alan kelimelerinden derlenmiştir.',
  },
];

export function PoolsPage({ today }: { today: string }) {
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
              <PoolTile key={p.id} pool={p} today={today} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function PoolTile({ pool, today }: { pool: PoolMeta; today: string }) {
  const { settings, progress } = usePoolState(pool.id, today);
  const started = !!settings;
  const doneToday = settings && progress && progress.addedToday >= settings.dailyGoal;

  return (
    <a className="card pool-tile" href={`#/havuz/${pool.id}`}>
      <span className="pool-name">{pool.name}</span>
      <span className="muted small">{pool.description}</span>
      {progress && (
        <span className="pool-bar" aria-hidden>
          <span className="learn" style={{ width: `${(progress.learning / progress.total) * 100}%` }} />
          <span className="known" style={{ width: `${((progress.known + progress.alreadyHave) / progress.total) * 100}%` }} />
        </span>
      )}
      {progress && (
        <span className="small">
          {progress.total} kelime
          {started && (
            <>
              {' '}
              · öğreniliyor {progress.learning} · biliniyor {progress.known + progress.alreadyHave}
            </>
          )}
        </span>
      )}
      {settings && progress && (
        <span className={`small ${doneToday ? 'ok' : ''}`}>
          Bugün {progress.addedToday} / {settings.dailyGoal} {doneToday && '✓'}
        </span>
      )}
      {!started && <span className="small ok">Başla →</span>}
    </a>
  );
}
