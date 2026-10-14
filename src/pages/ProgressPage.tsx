import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { addDays } from '../dates';
import { db } from '../db';
import { Icon } from '../Icon';
import { activeDays, activityByDay, STAGES, stageDistribution, streak } from '../stats';
import { MODE_LABEL } from '../study/StudyPage';
import { MODES, type Mode } from '../types';

const WEEKDAY = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function weekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

export function ProgressPage({ today }: { today: string }) {
  const [mode, setMode] = useState<Mode>('recognition');
  const data = useLiveQuery(async () => {
    const cards = await db.cards.toArray();
    const logs = await db.logs.where('date').aboveOrEqual(addDays(today, -400)).toArray();
    return {
      cards,
      streak: streak(activeDays(logs, cards), today),
      week: activityByDay(logs, cards, today, 7),
    };
  }, [today]);
  if (!data) return null;

  const dist = stageDistribution(data.cards, mode);
  const total = data.cards.length;
  const maxDist = Math.max(1, ...dist);
  const maxDay = Math.max(1, ...data.week.map((d) => d.correct + d.wrong));
  const weekCorrect = data.week.reduce((n, d) => n + d.correct, 0);
  const weekAnswered = data.week.reduce((n, d) => n + d.correct + d.wrong, 0);

  return (
    <>
      <div className="stat-grid">
        <div className="stat">
          <strong style={{ color: data.streak.days ? '#f97316' : undefined }}>
            <Icon name="flame" size={18} /> {data.streak.days}
          </strong>
          <span>gün seri</span>
        </div>
        <div className="stat">
          <strong>{total}</strong>
          <span>toplam kart</span>
        </div>
        <div className="stat">
          <strong>{weekAnswered ? Math.round((weekCorrect / weekAnswered) * 100) : 0}%</strong>
          <span>7 günlük başarı</span>
        </div>
      </div>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Kademe dağılımı</h2>
        <div className="tabs" role="tablist">
          {MODES.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
        {total === 0 ? (
          <p className="muted">Henüz kart yok.</p>
        ) : (
          <div className="dist">
            {STAGES.map((s, i) => (
              <div key={s.name} className="dist-row" title={s.note}>
                <span className="name">
                  <span className="stage-dot" style={{ background: `var(--stage-${i})` }} />
                  {s.name}
                </span>
                <span className="bar">
                  <span style={{ width: `${(dist[i] / maxDist) * 100}%`, background: `var(--stage-${i})` }} />
                </span>
                <span className="count">{dist[i]}</span>
              </div>
            ))}
          </div>
        )}
        <p className="muted small" style={{ marginBottom: 0 }}>
          Kart her doğru cevapta bir kademe yükselir, bilinmezse bir kademe düşer. Efsane: tüm kontrolleri geçti, artık
          sorulmaz.
        </p>
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0 }}>Son 7 gün</h2>
        <div className="week-chart">
          {data.week.map((d) => {
            const n = d.correct + d.wrong;
            return (
              <div key={d.date} className={`col${d.date === today ? ' today' : ''}`} title={`${d.correct} doğru, ${d.wrong} yanlış, ${d.added} eklendi`}>
                <span>{n || ''}</span>
                <div className="stack" style={{ height: `${(n / maxDay) * 100}%`, minHeight: n ? 4 : 2 }}>
                  <span className="c" style={{ flex: d.correct }} />
                  <span className="w" style={{ flex: d.wrong }} />
                </div>
                <span>{weekday(d.date)}</span>
              </div>
            );
          })}
        </div>
        <div className="legend">
          <span>
            <span className="stage-dot" style={{ background: 'var(--good)' }} /> Doğru
          </span>
          <span>
            <span className="stage-dot" style={{ background: 'var(--bad)' }} /> Yanlış
          </span>
          <span>Bu hafta {data.week.reduce((n, d) => n + d.added, 0)} kart eklendi</span>
        </div>
      </section>
    </>
  );
}
