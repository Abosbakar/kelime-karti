import { useEffect, useRef, useState } from 'react';
import { shuffle } from '../answer';
import { db } from '../db';
import { answerCard, getDueCards, markActuallyCorrect, type AnswerOutcome } from '../repo';
import type { Card, Mode } from '../types';
import { RecognitionCard } from './RecognitionCard';
import { SessionSummary } from './SessionSummary';
import { WritingCard } from './WritingCard';

export const MODE_LABEL: Record<Mode, string> = { recognition: 'Tanıma', writing: 'Yazım' };

export interface SessionEntry {
  outcome: AnswerOutcome;
  correct: boolean;
}

/**
 * Bir çalışma oturumu: bugün sorulacak kartlar karışık sırayla, her biri bir kez.
 * Her cevap anında kaydedilir; oturum istenildiği an bitirilebilir.
 */
export function StudyPage({ mode, today }: { mode: Mode; today: string }) {
  const [queue, setQueue] = useState<Card[] | null>(null);
  const [index, setIndex] = useState(0);
  const [entries, setEntries] = useState<Map<string, SessionEntry>>(new Map());
  const [finished, setFinished] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = useRef(false);

  // Kuyruk oturum başında bir kez oluşturulur; gün değişse de oturum bozulmaz.
  const startDay = useRef(today);
  useEffect(() => {
    getDueCards(db, mode, startDay.current).then((cards) => setQueue(shuffle(cards)));
  }, [mode]);

  if (!queue) return <p>Yükleniyor…</p>;

  const card = queue[index];
  if (finished || !card) {
    return <SessionSummary mode={mode} entries={[...entries.values()]} total={queue.length} />;
  }

  /** Cevabı kaydeder. Kaydedilen sonucu döndürür; kart artık sorulamıyorsa null. */
  async function answer(correct: boolean): Promise<SessionEntry | null> {
    if (busy.current) return null;
    busy.current = true;
    try {
      const outcome = await answerCard(db, card.id, mode, correct ? 'correct' : 'wrong', today);
      const entry = { outcome, correct };
      setEntries((m) => new Map(m).set(card.id, entry));
      setNotice(null);
      return entry;
    } catch (err) {
      setNotice(`Kart atlandı: ${err instanceof Error ? err.message : String(err)}`);
      next();
      return null;
    } finally {
      busy.current = false;
    }
  }

  async function fixToCorrect(entry: SessionEntry): Promise<boolean> {
    if (busy.current) return false;
    busy.current = true;
    try {
      const fixed = await markActuallyCorrect(db, entry.outcome, today);
      setEntries((m) => new Map(m).set(fixed.id, { outcome: { ...entry.outcome, card: fixed }, correct: true }));
      return true;
    } catch (err) {
      setNotice(`Düzeltilemedi: ${err instanceof Error ? err.message : String(err)}`);
      return false;
    } finally {
      busy.current = false;
    }
  }

  function next() {
    setIndex((i) => i + 1);
  }

  return (
    <>
      <div className="study-header">
        <span>
          <strong>{MODE_LABEL[mode]}</strong>{' '}
          <span className="muted">
            {index + 1} / {queue.length}
          </span>
        </span>
        <button type="button" className="secondary small" onClick={() => setFinished(true)}>
          Bitir
        </button>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      {notice && <p className="error-text">{notice}</p>}
      {mode === 'recognition' ? (
        <RecognitionCard
          key={card.id}
          card={card}
          onAnswer={async (correct) => {
            if (await answer(correct)) next();
          }}
        />
      ) : (
        <WritingCard key={card.id} card={card} onAnswer={answer} onFix={fixToCorrect} onNext={next} />
      )}
    </>
  );
}
