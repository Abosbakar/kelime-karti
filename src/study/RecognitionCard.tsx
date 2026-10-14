import { useEffect, useRef, useState } from 'react';
import { StageChip } from '../StageChip';
import { SwipeCard, type SwipeCardHandle } from '../SwipeCard';
import type { Card } from '../types';

/**
 * İngilizce gösterilir, dokununca kart dönüp Türkçesi görünür. Sağa kaydır: Bildim, sola: Bilemedim.
 * Klavye: Boşluk çevirir; 1 veya → Bildim; 2 veya ← Bilemedim.
 */
export function RecognitionCard({ card, onAnswer }: { card: Card; onAnswer: (correct: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  const swipe = useRef<SwipeCardHandle>(null);

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
  }, []);

  return (
    <>
      <SwipeCard
        ref={swipe}
        flipped={revealed}
        onFlip={() => setRevealed((r) => !r)}
        onSwipe={(dir) => onAnswer(dir === 'right')}
        leftLabel="Bilemedim"
        rightLabel="Bildim"
        front={
          <>
            <span className="corner">
              <StageChip progress={card.progress.recognition} />
            </span>
            <span className="flashcard-term" lang="en">
              {card.term}
            </span>
            <span className="hint">Anlamı için dokun</span>
          </>
        }
        back={
          <>
            <span className="muted" lang="en">
              {card.term}
            </span>
            <span className="flashcard-def big">{card.definition}</span>
            {card.example && (
              <span className="flashcard-example" lang="en">
                {card.example}
              </span>
            )}
          </>
        }
      />
      <div className="swipe-help" aria-hidden>
        <span>← Bilemedim</span>
        <span>Bildim →</span>
      </div>
      <div className="answer-buttons">
        <button type="button" className="bad" onClick={() => swipe.current?.fling('left')}>
          Bilemedim <kbd>2</kbd>
        </button>
        <button type="button" className="good" onClick={() => swipe.current?.fling('right')}>
          Bildim <kbd>1</kbd>
        </button>
      </div>
    </>
  );
}
