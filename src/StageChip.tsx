import { stageOf } from './stats';
import type { Progress } from './types';

/** Kartın bir moddaki kademesi: renkli nokta + isim (Acemi, Çırak …). */
export function StageChip({ progress }: { progress: Progress }) {
  const s = stageOf(progress);
  return (
    <span className="stage-chip" title={s.note}>
      <span className="stage-dot" style={{ background: `var(--stage-${s.index})` }} />
      {s.name}
    </span>
  );
}
