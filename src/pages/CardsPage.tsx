import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState, type FormEvent } from 'react';
import { formatDisplayDate } from '../dates';
import { db } from '../db';
import { poolById } from '../pools';
import { deleteCard, updateCard } from '../repo';
import { getDueDate } from '../scheduler';
import { StageChip } from '../StageChip';
import { matchesSearch } from '../stats';
import { MODE_LABEL } from '../study/StudyPage';
import { MODES, type Card, type Progress } from '../types';

const PAGE = 200;

/** Kartlar eklenme tarihine göre gruplu (yeniden eskiye). Arama, düzenleme, silme. */
export function CardsPage() {
  const cards = useLiveQuery(() => db.cards.orderBy('createdDate').reverse().toArray(), []);
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => (cards ?? []).filter((c) => matchesSearch(c, query)), [cards, query]);
  const groups = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const c of filtered.slice(0, limit)) {
      const g = map.get(c.createdDate) ?? [];
      g.push(c);
      map.set(c.createdDate, g);
    }
    for (const g of map.values()) g.sort((a, b) => a.term.localeCompare(b.term, 'en'));
    return [...map.entries()];
  }, [filtered, limit]);
  const countByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of filtered) m.set(c.createdDate, (m.get(c.createdDate) ?? 0) + 1);
    return m;
  }, [filtered]);

  if (!cards) return null;

  return (
    <>
      <input
        type="search"
        className="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setLimit(PAGE);
        }}
        placeholder="Ara (İngilizce, Türkçe, örnek)"
        aria-label="Kartlarda ara"
      />
      <p className="muted">
        {query ? `${filtered.length} / ${cards.length} kart` : `${cards.length} kart`}
      </p>
      {cards.length === 0 && (
        <p>
          Henüz kart yok. <a href="#/ekle">Kart ekle</a>
        </p>
      )}
      {groups.map(([date, list]) => (
        <section key={date} className="card-group">
          <h2>
            {formatDisplayDate(date)} <span className="muted">· {countByDate.get(date)} kart</span>
          </h2>
          <ul className="card-list">
            {list.map((c) =>
              editing === c.id ? (
                <CardEditor key={c.id} card={c} onDone={() => setEditing(null)} />
              ) : (
                <CardRow key={c.id} card={c} onEdit={() => setEditing(c.id)} />
              ),
            )}
          </ul>
        </section>
      ))}
      {filtered.length > limit && (
        <button type="button" className="secondary" onClick={() => setLimit((l) => l + PAGE)}>
          Daha fazla göster ({filtered.length - limit} kart daha)
        </button>
      )}
    </>
  );
}

function shortDate(d: string): string {
  return formatDisplayDate(d).replace(/ \d{4}$/, '');
}

function StageInfo({ p }: { p: Progress }) {
  const due = getDueDate(p);
  return (
    <span className="stage">
      <StageChip progress={p} />
      {due && <span className="muted"> · {shortDate(due)}</span>}
    </span>
  );
}

function CardRow({ card, onEdit }: { card: Card; onEdit: () => void }) {
  async function remove() {
    if (window.confirm(`"${card.term}" kartı ve tüm geçmişi silinsin mi?`)) await deleteCard(db, card.id);
  }
  return (
    <li className="card-row">
      <div className="card-text">
        <span lang="en">
          <strong>{card.term}</strong>
        </span>{' '}
        — {card.definition}
        {card.source && <span className="source-badge">{poolById(card.source)?.name ?? card.source}</span>}
        {card.example && (
          <span className="flashcard-example small" lang="en">
            {card.example}
          </span>
        )}
        <span className="stages">
          {MODES.map((m) => (
            <span key={m}>
              <span className="muted">{MODE_LABEL[m]}</span> <StageInfo p={card.progress[m]} />
            </span>
          ))}
        </span>
      </div>
      <div className="row-actions">
        <button type="button" className="icon" onClick={onEdit} aria-label={`${card.term} kartını düzenle`} title="Düzenle">
          ✎
        </button>
        <button type="button" className="icon" onClick={remove} aria-label={`${card.term} kartını sil`} title="Sil">
          🗑
        </button>
      </div>
    </li>
  );
}

function CardEditor({ card, onDone }: { card: Card; onDone: () => void }) {
  const [term, setTerm] = useState(card.term);
  const [definition, setDefinition] = useState(card.definition);
  const [example, setExample] = useState(card.example ?? '');
  const [error, setError] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await updateCard(db, card.id, { term, definition, example });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <li className="card-row editing">
      <form onSubmit={save} onKeyDown={(e) => e.key === 'Escape' && onDone()}>
        <input type="text" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="İngilizce" autoFocus lang="en" />
        <input type="text" value={definition} onChange={(e) => setDefinition(e.target.value)} aria-label="Türkçe" />
        <input
          type="text"
          value={example}
          onChange={(e) => setExample(e.target.value)}
          aria-label="Örnek cümle"
          placeholder="Örnek cümle (opsiyonel)"
          lang="en"
        />
        {error && <p className="error-text">{error}</p>}
        <div className="actions">
          <button type="submit" className="primary small">
            Kaydet
          </button>
          <button type="button" className="secondary small" onClick={onDone}>
            İptal
          </button>
        </div>
      </form>
    </li>
  );
}
