import { useMemo, useState, type KeyboardEvent } from 'react';
import { parsePasted, resolveSeparator, type SeparatorChoice } from '../importParse';
import { ImportPreview } from './ImportPreview';

type TermKind = 'tab' | 'comma' | 'custom';
type CardKind = 'newline' | 'semicolon' | 'custom';

const choice = (kind: string, custom: string) =>
  (kind === 'custom' ? { kind, value: custom } : { kind }) as SeparatorChoice;

/** Quizlet tarzı yapıştırma: metin + terim/kart ayırıcı seçimi. */
export function PasteImport({ today }: { today: string }) {
  const [text, setText] = useState('');
  const [termKind, setTermKind] = useState<TermKind>('tab');
  const [termCustom, setTermCustom] = useState('');
  const [cardKind, setCardKind] = useState<CardKind>('newline');
  const [cardCustom, setCardCustom] = useState('');
  const [removed, setRemoved] = useState<{ key: string; lines: Set<number> }>({ key: '', lines: new Set() });
  const [saved, setSaved] = useState<number | null>(null);

  const termSep = resolveSeparator(choice(termKind, termCustom));
  const cardSep = resolveSeparator(choice(cardKind, cardCustom));
  const sameSep = termSep !== null && termSep === cardSep;

  // Metin veya ayırıcı değişince satır numaraları değişir; silinen satırlar sıfırlanır.
  const key = JSON.stringify([text, termSep, cardSep]);
  const removedLines = removed.key === key ? removed.lines : new Set<number>();

  const rows = useMemo(() => {
    if (!termSep || !cardSep || sameSep || !text.trim()) return [];
    return parsePasted(text, termSep, cardSep).filter((r) => !removedLines.has(r.line));
  }, [text, termSep, cardSep, sameSep, removedLines]);

  // Tab tuşu odak değiştirmek yerine metne sekme ekler (Tab ayırıcıyla elle yazabilmek için).
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Tab' || e.shiftKey || termKind !== 'tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    setText(text.slice(0, s) + '\t' + text.slice(end));
    requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
  }

  return (
    <>
      <div className="card">
        <label className="field">
          <span>Kelimeleri yapıştır</span>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setSaved(null);
            }}
            onKeyDown={onKeyDown}
            placeholder={'apple\telma\nbook\tkitap'}
            spellCheck={false}
          />
        </label>
        <fieldset>
          <legend>Terim ile tanım arası</legend>
          <div className="radios">
            {(
              [
                ['tab', 'Tab'],
                ['comma', 'Virgül'],
                ['custom', 'Özel'],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                <input type="radio" name="termSep" checked={termKind === k} onChange={() => setTermKind(k)} /> {label}
              </label>
            ))}
            {termKind === 'custom' && (
              <input type="text" value={termCustom} onChange={(e) => setTermCustom(e.target.value)} placeholder="örn. -" aria-label="Özel terim ayırıcı" />
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend>Kartlar arası</legend>
          <div className="radios">
            {(
              [
                ['newline', 'Yeni satır'],
                ['semicolon', 'Noktalı virgül'],
                ['custom', 'Özel'],
              ] as const
            ).map(([k, label]) => (
              <label key={k}>
                <input type="radio" name="cardSep" checked={cardKind === k} onChange={() => setCardKind(k)} /> {label}
              </label>
            ))}
            {cardKind === 'custom' && (
              <input type="text" value={cardCustom} onChange={(e) => setCardCustom(e.target.value)} placeholder="örn. \n\n" aria-label="Özel kart ayırıcı" />
            )}
          </div>
        </fieldset>
        <p className="muted">
          {termKind === 'tab'
            ? 'Tab ile ayrılmış 3. sütun örnek cümle olarak alınır. Özel ayırıcıda \\t ve \\n yazılabilir.'
            : 'Terim ayırıcının yalnızca ilk geçtiği yerden bölünür; tanımda aynı karakter kalabilir.'}
        </p>
        {(!termSep || !cardSep) && <p className="error-text">Özel ayırıcı boş olamaz.</p>}
        {sameSep && <p className="error-text">Terim ve kart ayırıcısı aynı olamaz.</p>}
        {saved !== null && <p className="ok">{saved} kart eklendi.</p>}
      </div>
      <ImportPreview
        rows={rows}
        today={today}
        onRemove={(line) => setRemoved({ key, lines: new Set(removedLines).add(line) })}
        onSaved={(n) => {
          setText('');
          setSaved(n);
        }}
      />
    </>
  );
}
