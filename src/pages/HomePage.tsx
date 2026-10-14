import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, formatDisplayDate } from '../dates';
import { db } from '../db';
import { Icon } from '../Icon';
import { poolById } from '../pools';
import { INTERVALS } from '../scheduler';
import { activeDays, homeStats, STAGES, stageDistribution, streak } from '../stats';
import { MODE_LABEL } from '../study/StudyPage';
import { MODES } from '../types';

export function HomePage({ today }: { today: string }) {
  const data = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    // Seri için bir yıldan eski kayıtlara gerek yok.
    const logs = await db.logs.where('date').aboveOrEqual(addDays(today, -400)).toArray();
    return {
      stats: homeStats(cards, today),
      streak: streak(activeDays(logs, cards), today),
      answeredToday: logs.filter((l) => l.date === today && l.result !== 'missed').length,
      dist: stageDistribution(cards, 'recognition'),
    };
  }, [today]);
  if (!data) return null;
  const { stats } = data;
  const dueTotal = MODES.reduce((n, m) => n + stats.modes[m].due, 0);

  return (
    <>
      <header className="app-bar">
        <h1 className="title">Kelime Kartı</h1>
        <div className="actions-right">
          <a className="icon-btn" href="#/ayarlar" aria-label="Ayarlar">
            <Icon name="gear" size={20} />
          </a>
        </div>
      </header>

      <section className="hero">
        <div className="date">{formatDisplayDate(today, true)}</div>
        <div className="big">{dueTotal}</div>
        <div className="sub">{dueTotal ? 'tekrar bugün seni bekliyor' : stats.total ? 'bugünlük tekrar yok, harika!' : 'henüz kart yok'}</div>
        <div className="row">
          <span className={`chip${data.streak.days ? ' streak-on' : ''}`}>
            <Icon name="flame" size={16} /> {data.streak.days} gün seri
            {data.streak.days > 0 && !data.streak.activeToday && ' · bugün devam et'}
          </span>
          <span className="chip">Bugün {data.answeredToday} cevap</span>
        </div>
      </section>

      {stats.total === 0 ? (
        <div className="card">
          <p style={{ marginTop: 0 }}>Kendi kelimelerini ekleyebilir ya da hazır bir havuzdan başlayabilirsin.</p>
          <div className="actions">
            <a className="button primary" href="#/havuzlar">
              Hazır havuzlar
            </a>
            <a className="button secondary" href="#/ekle">
              Kart ekle
            </a>
          </div>
        </div>
      ) : (
        <div className="mode-grid">
          {MODES.map((m) => {
            const s = stats.modes[m];
            return (
              <section key={m} className="card mode-card">
                <h2>{MODE_LABEL[m]}</h2>
                <p className="due-count">
                  <strong>{s.due}</strong> <span className="muted">kart bugün</span>
                </p>
                {s.breakdown.length > 0 && (
                  <ul className="breakdown">
                    {s.breakdown.map((b) => {
                      const stage = INTERVALS.indexOf(b.interval as (typeof INTERVALS)[number]) - 1;
                      return (
                        <li key={b.interval}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span className="stage-dot" style={{ background: `var(--stage-${stage})` }} />
                            {b.interval} gün önceki
                            <span className="muted small">· {STAGES[stage].name}</span>
                          </span>
                          <strong>{b.count}</strong>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <a className={`button primary${s.due ? '' : ' disabled'}`} href={`#/calis/${m}`} aria-disabled={!s.due}>
                  {s.due ? `${MODE_LABEL[m]} çalış` : 'Bugünlük bitti ✓'}
                </a>
              </section>
            );
          })}
        </div>
      )}

      <ActivePools today={today} />

      {stats.total > 0 && (
        <a className="card" href="#/ilerleme" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <strong>Kademe dağılımı</strong>
            <span className="muted small">
              {stats.total} kart · {stats.addedToday} bugün eklendi →
            </span>
          </div>
          <div className="stacked" aria-hidden>
            {data.dist.map((n, i) =>
              n ? <span key={i} style={{ width: `${(n / stats.total) * 100}%`, background: `var(--stage-${i})` }} /> : null,
            )}
          </div>
          <div className="legend">
            {data.dist.map((n, i) =>
              n ? (
                <span key={i}>
                  <span className="stage-dot" style={{ background: `var(--stage-${i})` }} />
                  {STAGES[i].name} {n}
                </span>
              ) : null,
            )}
          </div>
        </a>
      )}
    </>
  );
}

/** Başlatılmış havuzlar ve bugünkü yeni kelime hedefi. */
function ActivePools({ today }: { today: string }) {
  const pools = useLiveQuery(async () => {
    const settings = await db.poolSettings.toArray();
    return Promise.all(
      settings.map(async (s) => ({
        ...s,
        addedToday: await db.poolDecisions
          .where('[poolId+date]')
          .equals([s.poolId, today])
          .filter((d) => d.decision === 'learn')
          .count(),
      })),
    );
  }, [today]);
  if (!pools?.length) return null;

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Yeni kelimeler</h2>
      <ul className="breakdown">
        {pools.map((p) => {
          const done = p.addedToday >= p.dailyGoal;
          return (
            <li key={p.poolId}>
              <a href={`#/havuz/${p.poolId}`}>{poolById(p.poolId)?.name ?? p.poolId}</a>
              <span className={done ? 'ok' : undefined}>
                <strong>
                  {p.addedToday} / {p.dailyGoal}
                </strong>{' '}
                {done ? '✓' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
