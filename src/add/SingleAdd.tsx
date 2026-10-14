import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState, type FormEvent } from 'react';
import { db } from '../db';
import { normalizeTerm } from '../importParse';
import { addCard, getExistingTerms } from '../repo';

/** Tek tek ekleme. Herhangi bir alanda Enter kaydeder ve imleç İngilizce alanına döner. */
export function SingleAdd({ today }: { today: string }) {
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  const [example, setExample] = useState('');
  const [last, setLast] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const termRef = useRef<HTMLInputElement>(null);
  const defRef = useRef<HTMLInputElement>(null);
  const existing = useLiveQuery(() => getExistingTerms(db), []);

  const duplicate = term.trim() !== '' && existing?.has(normalizeTerm(term));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Eksik alan varsa Enter o alana geçirir (İngilizce yazıp Enter → Türkçe alanı).
    if (!term.trim()) return termRef.current?.focus();
    if (!definition.trim()) return defRef.current?.focus();
    try {
      const card = await addCard(db, { term, definition, example }, today);
      setLast(`${card.term} — ${card.definition}`);
      setCount((n) => n + 1);
      setTerm('');
      setDefinition('');
      setExample('');
      setError(null);
      termRef.current?.focus();
    } catch (err) {
      setError(String(err));
    }
  }

  return (
    <form className="card" onSubmit={onSubmit}>
      <label className="field">
        <span>İngilizce</span>
        <input
          ref={termRef}
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
        {duplicate && <span className="muted" style={{ color: 'var(--warn)' }}>Bu kelime zaten kayıtlı</span>}
      </label>
      <label className="field">
        <span>Türkçe</span>
        <input ref={defRef} type="text" value={definition} onChange={(e) => setDefinition(e.target.value)} enterKeyHint="done" />
      </label>
      <label className="field">
        <span>Örnek cümle (opsiyonel)</span>
        <input type="text" value={example} onChange={(e) => setExample(e.target.value)} enterKeyHint="done" />
      </label>
      <div className="actions">
        <button className="primary" type="submit">
          Kaydet
        </button>
        <span className="muted">Enter ile kaydedip sonrakine geç</span>
      </div>
      {error && <p className="error-text">{error}</p>}
      {last && (
        <p className="ok">
          Kaydedildi: {last} {count > 1 && <span className="muted">(bu oturumda {count} kart)</span>}
        </p>
      )}
    </form>
  );
}
