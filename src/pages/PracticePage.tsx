import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { addDays } from '../dates';
import { db } from '../db';
import { Icon } from '../Icon';
import {
  answerPractice,
  buildChoices,
  checkTurkish,
  currentQuestion,
  hintFor,
  progressOf,
  startPractice,
  type PracticeCard,
  type PracticeState,
} from '../practice';

const RANGES = [
  { days: 1, label: 'Bugün' },
  { days: 3, label: 'Son 3 gün' },
  { days: 7, label: 'Son 7 gün' },
] as const;

const ROUND = 10; // bu kadar sorudan sonra tur özeti

/**
 * Alıştırma: seçilen günlerde eklenen kelimelerle Quizlet "Öğren" tarzı çalışma.
 * Kartların kademesini ve tekrar takvimini etkilemez.
 */
export function PracticePage({ today }: { today: string }) {
  const [days, setDays] = useState(1);
  const [session, setSession] = useState<{ cards: PracticeCard[]; pool: string[]; run: number } | null>(null);

  const data = useLiveQuery(async () => {
    const all = await db.cards.toArray();
    return { all, byDays: (n: number) => all.filter((c) => c.createdDate > addDays(today, -n)) };
  }, [today]);

  if (!data) return null;
  const selected = data.byDays(days);

  if (session) {
    return (
      <Session
        key={session.run}
        cards={session.cards}
        pool={session.pool}
        onRestart={(cards) => setSession({ ...session, cards, run: session.run + 1 })}
      />
    );
  }

  return (
    <>
      <p className="muted">
        Yeni öğrendiğin kelimeleri pekiştir: her kelime önce şıklı, sonra yazılı sorulur; bilemediklerin tekrar gelir.
        Alıştırma kartların kademesini ve tekrar takvimini <strong>değiştirmez</strong>.
      </p>
      <div className="tabs" role="tablist">
        {RANGES.map((r) => (
          <button key={r.days} type="button" role="tab" aria-selected={days === r.days} onClick={() => setDays(r.days)}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="card">
        <p style={{ marginTop: 0 }}>
          <strong style={{ fontSize: '1.6rem' }}>{selected.length}</strong> kelime ·{' '}
          <span className="muted">{selected.length * 2} soru</span>
        </p>
        {selected.length === 0 ? (
          <p className="muted">
            Bu aralıkta eklenmiş kelime yok. <a href="#/havuzlar">Havuzlardan</a> ya da <a href="#/ekle">Ekle</a>{' '}
            sekmesinden yeni kelime ekleyebilirsin.
          </p>
        ) : (
          <button
            type="button"
            className="primary"
            style={{ width: '100%' }}
            onClick={() =>
              setSession({
                cards: selected.map(({ id, term, definition }) => ({ id, term, definition })),
                pool: data.all.map((c) => c.definition),
                run: 0,
              })
            }
          >
            Alıştırmaya başla
          </button>
        )}
      </div>
    </>
  );
}

interface Feedback {
  correct: boolean;
  chosen?: string; // şıklıda seçilen
  typed?: string; // yazılıda yazılan
}

function Session({ cards, pool, onRestart }: { cards: PracticeCard[]; pool: string[]; onRestart: (cards: PracticeCard[]) => void }) {
  const [state, setState] = useState<PracticeState>(() => startPractice(cards));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [round, setRound] = useState<{ cardId: string; correct: boolean }[]>([]);
  const [showRound, setShowRound] = useState(false);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const q = currentQuestion(state);
  const card = q ? byId.get(q.cardId)! : null;
  const { done, total } = progressOf(state);

  function submit(fb: Feedback) {
    if (feedback) return;
    setFeedback(fb);
  }

  function next(override?: boolean) {
    if (!feedback || !q) return;
    const correct = override ?? feedback.correct;
    const after = answerPractice(state, correct);
    setState(after);
    setFeedback(null);
    setRound([...round, { cardId: q.cardId, correct }]);
    if (currentQuestion(after) && after.answered % ROUND === 0) setShowRound(true);
  }

  // Doğru cevapta kısa bir onaydan sonra kendiliğinden geç.
  useEffect(() => {
    if (!feedback?.correct) return;
    const t = window.setTimeout(() => next(), 700);
    return () => window.clearTimeout(t);
  });

  const bar = (
    <>
      <div className="study-header">
        <span>
          <strong>Alıştırma</strong>{' '}
          <span className="muted">
            {done} / {total}
          </span>
        </span>
        {state.streak >= 3 && (
          <span className="chip streak-on">
            <Icon name="flame" size={16} /> {state.streak} doğru üst üste
          </span>
        )}
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${(done / total) * 100}%`, background: state.streak >= 3 ? 'linear-gradient(90deg, #f59e0b, #f97316)' : undefined }} />
      </div>
    </>
  );

  if (!q || !card) {
    const hard = state.items.filter((i) => i.mistakes > 0);
    return (
      <>
        {bar}
        <div className="card">
          <h2 style={{ marginTop: 0 }} className="ok">
            Tamamlandı 🎉
          </h2>
          <p>
            {cards.length} kelime, {state.answered} cevap, {state.answered - total} hata.
          </p>
          <ul className="breakdown">
            {state.items.map((i) => {
              const c = byId.get(i.cardId)!;
              return (
                <li key={i.cardId}>
                  <span>
                    <strong lang="en">{c.term}</strong> <span className="muted small">{c.definition}</span>
                  </span>
                  <span className={i.mistakes ? 'error-text' : 'ok'}>{i.mistakes ? `${i.mistakes} hata` : '✓'}</span>
                </li>
              );
            })}
          </ul>
          <div className="actions">
            <button type="button" className="primary" onClick={() => onRestart(cards)}>
              Tekrar
            </button>
            {hard.length > 0 && hard.length < cards.length && (
              <button type="button" className="secondary" onClick={() => onRestart(hard.map((i) => byId.get(i.cardId)!))}>
                Hata yaptıklarımı tekrar ({hard.length})
              </button>
            )}
            <a className="button secondary" href="#/">
              Ana sayfa
            </a>
          </div>
        </div>
      </>
    );
  }

  if (showRound) {
    return (
      <>
        {bar}
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Tur bitti, böyle devam!</h2>
          <p className="muted">
            Toplam ilerleme: %{Math.round((done / total) * 100)} · bu turda {round.filter((r) => r.correct).length} /{' '}
            {round.length} doğru
          </p>
          <ul className="breakdown">
            {round.map((r, i) => (
              <li key={i}>
                <span lang="en">{byId.get(r.cardId)!.term}</span>
                <span className={r.correct ? 'ok' : 'error-text'}>{r.correct ? '✓' : '✗'}</span>
              </li>
            ))}
          </ul>
          <button type="button" className="primary" style={{ width: '100%' }} autoFocus onClick={() => {
              setShowRound(false);
              setRound([]);
            }}
          >
            Devam et
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {bar}
      {q.kind === 'choice' ? (
        <ChoiceQuestion key={`${state.answered}-c`} card={card} pool={pool} feedback={feedback} onAnswer={submit} onNext={() => next()} />
      ) : (
        <WrittenQuestion key={`${state.answered}-w`} card={card} feedback={feedback} onAnswer={submit} onNext={next} />
      )}
    </>
  );
}

function QuestionHead({ card, label }: { card: PracticeCard; label: string }) {
  return (
    <div className="card practice-term">
      <span className="muted small">{label}</span>
      <span className="flashcard-term" lang="en">
        {card.term}
      </span>
    </div>
  );
}

function ChoiceQuestion(props: {
  card: PracticeCard;
  pool: string[];
  feedback: Feedback | null;
  onAnswer: (f: Feedback) => void;
  onNext: () => void;
}) {
  const { card, pool, feedback, onAnswer, onNext } = props;
  const choices = useMemo(() => buildChoices(card.definition, pool), [card, pool]);
  const correctChoice = card.definition.trim();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      if (feedback) {
        if (!feedback.correct) {
          e.preventDefault();
          onNext();
        }
        return;
      }
      const n = Number(e.key);
      if (n >= 1 && n <= choices.length) {
        const chosen = choices[n - 1];
        onAnswer({ correct: chosen === correctChoice, chosen });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <QuestionHead card={card} label="Anlamını seç" />
      <div className="choices">
        {choices.map((c, i) => {
          const state = !feedback ? '' : c === correctChoice ? ' right' : c === feedback.chosen ? ' wrong' : ' dim';
          return (
            <button
              key={c}
              type="button"
              className={`choice${state}`}
              disabled={!!feedback}
              onClick={() => onAnswer({ correct: c === correctChoice, chosen: c })}
            >
              <span className="num">{i + 1}</span>
              {c}
            </button>
          );
        })}
      </div>
      {feedback && !feedback.correct && (
        <div className="practice-feedback">
          <span className="error-text">
            <strong>Henüz öğreniyorsun, sorun değil!</strong>
          </span>
          <button type="button" className="primary" autoFocus onClick={onNext}>
            Devam
          </button>
        </div>
      )}
    </>
  );
}

const TR_LETTERS = ['ç', 'ğ', 'ı', 'İ', 'ö', 'ş', 'ü'];

function WrittenQuestion(props: {
  card: PracticeCard;
  feedback: Feedback | null;
  onAnswer: (f: Feedback) => void;
  onNext: (override?: boolean) => void;
}) {
  const { card, feedback, onAnswer, onNext } = props;
  const [input, setInput] = useState('');
  const [hint, setHint] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function submit(e?: FormEvent) {
    e?.preventDefault();
    if (feedback || !input.trim()) return;
    onAnswer({ correct: checkTurkish(input, card.definition), typed: input });
  }

  function insert(ch: string) {
    const el = inputRef.current;
    if (!el) return;
    const s = el.selectionStart ?? input.length;
    const end = el.selectionEnd ?? input.length;
    setInput(input.slice(0, s) + ch + input.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + ch.length, s + ch.length);
    });
  }

  return (
    <>
      <QuestionHead card={card} label="Türkçesini yaz" />
      <form onSubmit={submit} className="card" style={{ marginTop: 0 }}>
        {!feedback && (
          <div className="letters" aria-label="Türkçe harfler">
            {TR_LETTERS.map((l) => (
              <button key={l} type="button" className="letter" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(l)}>
                {l}
              </button>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          readOnly={!!feedback}
          className={feedback ? (feedback.correct ? 'answer-ok' : 'answer-wrong') : undefined}
          placeholder="Türkçesini yaz"
          autoFocus
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          lang="tr"
          aria-label="Türkçesi"
        />
        {hint > 0 && !feedback && (
          <p className="muted small" style={{ letterSpacing: '0.08em' }}>
            İpucu: {hintFor(card.definition, hint)}
          </p>
        )}
        {!feedback ? (
          <div className="actions" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="secondary small" onClick={() => setHint((h) => h + 1)}>
              İpucu
            </button>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="secondary small" onClick={() => onAnswer({ correct: false, typed: '' })}>
                Bilmiyorum
              </button>
              <button type="submit" className="primary small" disabled={!input.trim()}>
                Cevapla
              </button>
            </span>
          </div>
        ) : feedback.correct ? (
          <p className="ok">
            <strong>Doğru!</strong> {card.definition}
          </p>
        ) : (
          <>
            <p className="error-text" style={{ marginBottom: 4 }}>
              <strong>Henüz öğreniyorsun, sorun değil!</strong>
            </p>
            <p style={{ margin: '0 0 8px' }}>
              <span className="muted small">Doğru cevap</span>
              <br />
              <strong>{card.definition}</strong>
            </p>
            <div className="actions">
              <button type="button" className="primary" autoFocus onClick={() => onNext()}>
                Devam
              </button>
              {feedback.typed && (
                <button type="button" className="secondary" onClick={() => onNext(true)}>
                  Aslında doğruydu
                </button>
              )}
            </div>
          </>
        )}
      </form>
    </>
  );
}
