import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { shuffle } from '../answer';
import { db } from '../db';
import { poolById, type PoolMeta, type PoolWord } from '../pools';
import { decidePoolWord, setPoolGoal, undoPoolDecision } from '../repo';
import { SwipeCard, type SwipeCardHandle } from '../SwipeCard';
import type { PoolDecision, PoolSettings } from '../types';
import { usePoolState } from '../usePool';

export function PoolSessionPage({ poolId, today }: { poolId: string; today: string }) {
  const pool = poolById(poolId);
  const { error, settings, progress } = usePoolState(poolId, today);
  const [editingGoal, setEditingGoal] = useState(false);

  if (!pool) return <p className="error-text">Havuz bulunamadı.</p>;
  if (error) {
    // Genelde sunucu kapalıyken ya da yeni sürüm yayınlandıktan sonra eski sekmede olur; yenilemek düzeltir.
    return (
      <div className="card">
        <p className="error-text">Havuz yüklenemedi: {error.message}</p>
        <p className="muted small">İnternet bağlantını kontrol edip sayfayı yenile.</p>
        <button type="button" className="primary" onClick={() => window.location.reload()}>
          Sayfayı yenile
        </button>
      </div>
    );
  }
  if (settings === undefined || !progress) return <p>Yükleniyor…</p>;

  const header = (
    <>
      <p className="muted small">
        <a href="#/havuzlar">← Havuzlar</a>
      </p>
      <h1>{pool.name}</h1>
    </>
  );

  if (!settings || editingGoal) {
    return (
      <>
        {header}
        <GoalForm
          pool={pool}
          initial={settings?.dailyGoal}
          remaining={progress.remaining.length}
          onSave={async (goal) => {
            await setPoolGoal(db, pool.id, goal, today);
            setEditingGoal(false);
          }}
          onCancel={settings ? () => setEditingGoal(false) : undefined}
        />
      </>
    );
  }

  return (
    <>
      {header}
      <div className="study-header">
        <span>
          Bugün <strong>{progress.addedToday}</strong> / {settings.dailyGoal} yeni kelime
        </span>
        <button type="button" className="secondary small" onClick={() => setEditingGoal(true)}>
          Hedefi değiştir
        </button>
      </div>
      <div className="progress-bar" aria-hidden>
        <div style={{ width: `${Math.min(progress.addedToday / settings.dailyGoal, 1) * 100}%` }} />
      </div>
      <Picker pool={pool} settings={settings} remaining={progress.remaining} addedToday={progress.addedToday} today={today} />
    </>
  );
}

const PRESETS = [5, 10, 15, 20];

function GoalForm(props: {
  pool: PoolMeta;
  initial?: number;
  remaining: number;
  onSave: (goal: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(String(props.initial ?? 10));
  const [error, setError] = useState<string | null>(null);
  const goal = Number(value);
  const days = goal > 0 ? Math.ceil(props.remaining / goal) : null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await props.onSave(goal);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className="card" onSubmit={submit}>
      <p>{props.pool.description}</p>
      <label className="field">
        <span>Günde kaç yeni kelime öğrenmek istiyorsun?</span>
        <input type="number" inputMode="numeric" min={1} max={200} value={value} onChange={(e) => setValue(e.target.value)} />
      </label>
      <div className="radios">
        {PRESETS.map((n) => (
          <button key={n} type="button" className="secondary small" onClick={() => setValue(String(n))}>
            {n}
          </button>
        ))}
      </div>
      {days !== null && Number.isInteger(goal) && (
        <p className="muted small">
          Kalan {props.remaining} kelime, hepsini öğrenmeye alırsan yaklaşık {days} gün sürer. Bildiğin kelimeler hedefe
          sayılmaz.
        </p>
      )}
      {error && <p className="error-text">{error}</p>}
      <div className="actions">
        <button type="submit" className="primary">
          {props.initial ? 'Kaydet' : 'Başla'}
        </button>
        {props.onCancel && (
          <button type="button" className="secondary" onClick={props.onCancel}>
            İptal
          </button>
        )}
      </div>
    </form>
  );
}

/**
 * Havuzdan kelimeleri karışık sırayla gösterir. Sıra sayfa açıldığında bir kez belirlenir; karar
 * verilen kelimeler (canlı sorgu ile) listeden düşer.
 */
function Picker(props: { pool: PoolMeta; settings: PoolSettings; remaining: PoolWord[]; addedToday: number; today: string }) {
  const { pool, settings, remaining, today } = props;
  const [order, setOrder] = useState<Map<string, number> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [last, setLast] = useState<PoolDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Karar verilen kelime, kayıt bitip canlı sorgu güncellenene kadar beklemeden ekrandan düşer;
  // böylece hızlı art arda basışlar kaybolmaz. Kayıt başarısız olursa kelime geri gelir.
  const [pending, setPending] = useState<ReadonlyMap<string, PoolDecision['decision']>>(new Map());
  const undoing = useRef(false);
  const decisionSeq = useRef(0);
  const swipe = useRef<SwipeCardHandle>(null);

  useEffect(() => {
    if (!order && remaining.length) setOrder(new Map(shuffle(remaining).map((w, i) => [w[0], i])));
  }, [order, remaining]);

  const visible = useMemo(() => remaining.filter((w) => !pending.has(w[0])), [remaining, pending]);
  // Kaydı yapılmış ama canlı sorguya henüz yansımamış "öğrenmeliyim"ler de bugünkü sayıya eklenir.
  const addedToday =
    props.addedToday + remaining.filter((w) => pending.get(w[0]) === 'learn').length;

  // Sıraya sonradan giren kelime (ör. geri alınan) sona eklenir.
  const current = useMemo(() => {
    if (!order) return null;
    let best: PoolWord | null = null;
    let bestRank = Infinity;
    for (const w of visible) {
      const rank = order.get(w[0]) ?? order.size;
      if (rank < bestRank) (best = w), (bestRank = rank);
    }
    return best;
  }, [order, visible]);

  const goalReached = addedToday >= settings.dailyGoal;

  async function decide(decision: PoolDecision['decision']) {
    if (!current || (decision === 'learn' && goalReached)) return;
    const word = current;
    const seq = ++decisionSeq.current;
    setPending((p) => new Map(p).set(word[0], decision));
    setRevealed(false);
    try {
      const d = await decidePoolWord(db, pool.id, word, decision, today);
      // Kayıtlar farklı sırayla bitebilir; "Geri al" her zaman en son basılan kelimeyi göstersin.
      if (seq === decisionSeq.current) setLast(d);
      setError(null);
    } catch (err) {
      setPending((p) => {
        const n = new Map(p);
        n.delete(word[0]);
        return n;
      });
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function undo() {
    if (!last || undoing.current) return;
    undoing.current = true;
    try {
      await undoPoolDecision(db, pool.id, last.term, today);
      // Geri alınan kelime hemen tekrar gösterilsin.
      setOrder((o) => new Map(o).set(last.term, -1));
      setPending((p) => {
        const n = new Map(p);
        n.delete(last.term);
        return n;
      });
      setLast(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      undoing.current = false;
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target instanceof Element ? e.target : document.body;
      if (target.closest('input, textarea, select')) return;
      if (e.key === '1' || e.key === 'ArrowRight') swipe.current?.fling('right');
      else if (e.key === '2' || e.key === 'ArrowLeft') swipe.current?.fling('left');
      else if ((e.key === ' ' || e.key === 'Enter') && !target.closest('button, a, summary')) {
        e.preventDefault();
        setRevealed((r) => !r);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const undoBar = last && (
    <p className="muted small undo-line">
      {last.decision === 'learn' ? 'Eklendi' : 'Biliyorum'}: <strong lang="en">{last.term}</strong>{' '}
      <button type="button" className="link" onClick={undo}>
        Geri al
      </button>
    </p>
  );

  if (goalReached) {
    return (
      <div className="card">
        <h2 className="ok">Bugünkü hedef tamam 🎉</h2>
        <p>
          {addedToday} yeni kelime kartlarına eklendi. Yarın ilk tekrarları gelecek; yeni kelimeler için yarın tekrar uğra.
        </p>
        {undoBar}
        <div className="actions">
          <a className="button primary" href="#/">
            Ana sayfa
          </a>
          <a className="button secondary" href="#/havuzlar">
            Havuzlar
          </a>
        </div>
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div className="card">
        <h2>Havuz bitti</h2>
        <p>{pool.name} havuzundaki tüm kelimeler için karar verdin.</p>
        {undoBar}
      </div>
    );
  }

  if (!current) return <p>Yükleniyor…</p>;

  return (
    <>
      <SwipeCard
        key={current[0]}
        ref={swipe}
        flipped={revealed}
        onFlip={() => setRevealed((r) => !r)}
        onSwipe={(dir) => decide(dir === 'right' ? 'known' : 'learn')}
        canSwipe={(dir) => dir === 'right' || !goalReached}
        leftLabel="Öğren"
        rightLabel="Biliyorum"
        front={
          <>
            <span className="flashcard-term" lang="en">
              {current[0]}
            </span>
            <span className="hint">Anlamı için dokun</span>
          </>
        }
        back={
          <>
            <span className="muted" lang="en">
              {current[0]}
            </span>
            <span className="flashcard-def big">{current[1]}</span>
          </>
        }
      />
      <div className="swipe-help" aria-hidden>
        <span>← Öğrenmeliyim</span>
        <span>Biliyorum →</span>
      </div>
      <div className="answer-buttons">
        <button type="button" className="primary" onClick={() => swipe.current?.fling('left')}>
          Öğrenmeliyim <kbd>2</kbd>
        </button>
        <button type="button" className="secondary" onClick={() => swipe.current?.fling('right')}>
          Biliyorum <kbd>1</kbd>
        </button>
      </div>
      <p className="muted small">
        “Biliyorum” dediğin kelime kartlarına eklenmez ve bir daha gösterilmez. Kalan: {visible.length}
      </p>
      {undoBar}
      {error && <p className="error-text">{error}</p>}
    </>
  );
}
