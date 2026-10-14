import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from 'react';

export type SwipeDir = 'left' | 'right';

export interface SwipeCardHandle {
  /** Kartı o yöne uçurur (buton/klavye için); animasyon bitince onSwipe çağrılır. */
  fling(dir: SwipeDir): void;
}

interface Props {
  front: ReactNode;
  back: ReactNode;
  flipped: boolean;
  onFlip: () => void;
  onSwipe: (dir: SwipeDir) => void;
  leftLabel: string;
  rightLabel: string;
  /** Bu yöne kaydırılabilir mi (ör. günlük hedef dolduysa "öğrenmeliyim" kapalı). */
  canSwipe?: (dir: SwipeDir) => boolean;
}

const THRESHOLD = 90; // px; bunu geçen sürükleme cevap sayılır
const TAP_SLOP = 8; // px; bundan az hareket dokunma sayılır
const FLY_MS = 260;

/**
 * Dokununca dönen, sağa/sola kaydırılarak cevaplanan kart. Her yeni kart için `key` ile yeniden
 * oluşturulmalı (iç durum kart başına).
 */
export const SwipeCard = forwardRef<SwipeCardHandle, Props>(function SwipeCard(props, ref) {
  const { front, back, flipped, onFlip, onSwipe, leftLabel, rightLabel, canSwipe = () => true } = props;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<SwipeDir | null>(null);
  const start = useRef<{ x: number; y: number; id: number; horizontal: boolean | null } | null>(null);
  const done = useRef(false);

  function fling(dir: SwipeDir) {
    if (done.current) return;
    if (!canSwipe(dir)) {
      setDx(0);
      return;
    }
    done.current = true;
    setLeaving(dir);
    window.setTimeout(() => onSwipe(dir), FLY_MS);
  }

  useImperativeHandle(ref, () => ({ fling }));

  function onPointerDown(e: React.PointerEvent) {
    if (done.current || e.button !== 0) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, horizontal: null };
  }

  function onPointerMove(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (s.horizontal === null && Math.hypot(mx, my) > TAP_SLOP) {
      // Dikey hareket sayfa kaydırmasıdır; yatay hareket kartı sürükler.
      s.horizontal = Math.abs(mx) > Math.abs(my);
      if (s.horizontal) {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDragging(true);
      }
    }
    if (s.horizontal) setDx(mx);
  }

  function onPointerUp(e: React.PointerEvent) {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    start.current = null;
    setDragging(false);
    if (s.horizontal === null) {
      onFlip();
      return;
    }
    if (!s.horizontal) return;
    if (Math.abs(dx) > THRESHOLD) fling(dx > 0 ? 'right' : 'left');
    else setDx(0);
  }

  function onPointerCancel() {
    start.current = null;
    setDragging(false);
    setDx(0);
  }

  const x = leaving ? (leaving === 'right' ? 1 : -1) * window.innerWidth * 1.1 : dx;
  const rotate = Math.max(-18, Math.min(18, x / 14));
  const strength = Math.min(Math.abs(dx) / THRESHOLD, 1);
  const dir: SwipeDir | null = leaving ?? (dx > 0 ? 'right' : dx < 0 ? 'left' : null);
  const allowed = dir ? canSwipe(dir) : true;

  return (
    <div className="swipe-area">
      <div
        className={`swipe-card${dragging ? ' dragging' : ' animating'}`}
        style={{ transform: `translateX(${x}px) rotate(${rotate}deg)`, opacity: leaving ? 0 : 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="button"
        tabIndex={-1}
        aria-label={flipped ? 'Kartı çevir' : 'Anlamını görmek için dokun'}
      >
        <div className={`flip${flipped ? ' flipped' : ''}`}>
          <div className="face front">{front}</div>
          <div className="face back">{back}</div>
        </div>
        <span
          className="swipe-tint"
          style={{
            opacity: leaving ? 0.25 : allowed ? strength * 0.22 : 0,
            background: dir === 'right' ? 'var(--good)' : 'var(--bad)',
          }}
        />
        <span className="swipe-stamp right" style={{ opacity: dir === 'right' && allowed ? (leaving ? 1 : strength) : 0 }}>
          {rightLabel}
        </span>
        <span className="swipe-stamp left" style={{ opacity: dir === 'left' && allowed ? (leaving ? 1 : strength) : 0 }}>
          {leftLabel}
        </span>
      </div>
    </div>
  );
});
