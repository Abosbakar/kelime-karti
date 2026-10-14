import { useRef, useState, type FormEvent } from 'react';
import { checkAnswer } from '../answer';
import type { Card } from '../types';
import type { SessionEntry } from './StudyPage';

interface Props {
  card: Card;
  onAnswer: (correct: boolean) => Promise<SessionEntry | null>;
  onFix: (entry: SessionEntry) => Promise<boolean>;
  onNext: () => void;
}

/**
 * Türkçe gösterilir, İngilizcesi yazılır. Cevap kontrol edildiği an kaydedilir.
 * Yanlışsa doğru cevap gösterilir ve "Aslında doğruydu" ile düzeltilebilir.
 */
export function WritingCard({ card, onAnswer, onFix, onNext }: Props) {
  const [input, setInput] = useState('');
  const [entry, setEntry] = useState<SessionEntry | null>(null);
  const [fixed, setFixed] = useState(false);
  const nextRef = useRef<HTMLButtonElement>(null);

  async function submit(e: FormEvent | null, giveUp = false) {
    e?.preventDefault();
    if (entry || (!giveUp && !input.trim())) return;
    const r = await onAnswer(!giveUp && checkAnswer(input, card.term));
    if (r) setEntry(r);
  }

  const correct = entry?.correct || fixed;

  return (
    <>
      <div className="flashcard static">
        <span className="flashcard-def big">{card.definition}</span>
      </div>
      <form onSubmit={(e) => submit(e)}>
        <input
          type="text"
          className={entry ? (correct ? 'answer-ok' : 'answer-wrong') : undefined}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          readOnly={!!entry}
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="send"
          lang="en"
          placeholder="İngilizcesini yaz"
          aria-label="İngilizcesi"
        />
        {!entry && (
          <div className="answer-buttons">
            <button type="submit" className="primary" disabled={!input.trim()}>
              Kontrol et
            </button>
            <button type="button" className="secondary" onClick={() => submit(null, true)}>
              Bilmiyorum
            </button>
          </div>
        )}
      </form>
      {entry && (
        <div className="card result">
          {correct ? (
            <p className="ok">
              <strong>Doğru</strong>
              {fixed && ' (düzeltildi)'}
            </p>
          ) : (
            <p className="error-text">
              <strong>Yanlış.</strong> Doğru cevap:
            </p>
          )}
          <p className="flashcard-term" lang="en">
            {card.term}
          </p>
          {card.example && (
            <p className="flashcard-example" lang="en">
              {card.example}
            </p>
          )}
          <div className="answer-buttons">
            <button ref={nextRef} type="button" className="primary" onClick={onNext} autoFocus>
              Devam
            </button>
            {!correct && input.trim() && (
              <button
                type="button"
                className="secondary"
                onClick={async () => {
                  if (await onFix(entry)) {
                    setFixed(true);
                    nextRef.current?.focus();
                  }
                }}
              >
                Aslında doğruydu
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
