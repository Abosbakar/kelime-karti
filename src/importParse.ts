// Toplu ekleme için saf ayrıştırma: yapıştırılan metin ve tablo satırları → önizleme satırları.

export type SeparatorChoice =
  | { kind: 'tab' | 'comma' | 'newline' | 'semicolon' }
  | { kind: 'custom'; value: string };

export interface ParsedRow {
  line: number; // kaynaktaki satır/kayıt numarası (1'den başlar)
  raw: string;
  term: string;
  definition: string;
  example?: string;
  error?: string;
}

export interface PreviewRow extends ParsedRow {
  warning?: string;
}

const FIXED = { tab: '\t', comma: ',', newline: '\n', semicolon: ';' } as const;

/** Özel ayırıcıda kullanıcı "\t" veya "\n" yazabilir. Boş ayırıcı geçersizdir (null). */
export function resolveSeparator(choice: SeparatorChoice): string | null {
  if (choice.kind !== 'custom') return FIXED[choice.kind];
  const v = choice.value.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
  return v === '' ? null : v;
}

/** İngilizce taraftaki parantez içi notlar (ör. edatlar: "abound (in/with)") çıkarılır. */
export function stripNotes(s: string): string {
  const stripped = s.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped || s.trim();
}

/**
 * Tekrar kontrolü ve yazım modu karşılaştırması için: parantez içi notlar atılır, küçük harf,
 * fazla boşluklar tek boşluk. Böylece "abound (in/with)" ile "abound" aynı kelime sayılır.
 */
export function normalizeTerm(s: string): string {
  return stripNotes(s)
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/̇/g, '') // "İ".toLowerCase() → "i̇" noktasını at
    .normalize('NFC');
}

function validate(row: ParsedRow): ParsedRow {
  if (row.error) return row;
  if (!row.term) return { ...row, error: 'İngilizce kelime boş' };
  if (!row.definition) return { ...row, error: 'Türkçe anlam boş' };
  return row;
}

function makeRow(line: number, raw: string, term: string, definition: string, example?: string): ParsedRow {
  const row: ParsedRow = { line, raw, term: term.trim(), definition: definition.trim() };
  const ex = example?.trim();
  if (ex) row.example = ex;
  return validate(row);
}

/**
 * Quizlet tarzı yapıştırma. Terim ayırıcının ilk geçtiği yerden bölünür; tanımda virgül olabilir.
 * Yalnızca Tab ayırıcıda (tablodan kopyalama) ikinci Tab'dan sonrası örnek cümle sayılır.
 */
export function parsePasted(text: string, termSep: string, cardSep: string): ParsedRow[] {
  const normalized = text.replace(/\r\n?/g, '\n');
  const rows: ParsedRow[] = [];
  normalized.split(cardSep).forEach((chunk, i) => {
    const raw = cardSep === '\n' ? chunk : chunk.replace(/\n/g, ' ');
    if (!raw.trim()) return;
    const line = i + 1;
    const at = raw.indexOf(termSep);
    if (at < 0) {
      rows.push({ line, raw: raw.trim(), term: raw.trim(), definition: '', error: 'Terim ile tanım arasında ayırıcı yok' });
      return;
    }
    const term = raw.slice(0, at);
    let definition = raw.slice(at + termSep.length);
    let example: string | undefined;
    if (termSep === '\t') {
      const t = definition.indexOf('\t');
      if (t >= 0) {
        example = definition.slice(t + 1).replace(/\t/g, ' ');
        definition = definition.slice(0, t);
      }
    }
    rows.push(makeRow(line, raw.trim(), term, definition, example));
  });
  return rows;
}

const cellText = (v: unknown): string => (v == null ? '' : String(v)).trim();

/** Excel/CSV satırları: 1. sütun İngilizce, 2. Türkçe, opsiyonel 3. örnek cümle. Boş satırlar atlanır. */
export function parseRows(rows: readonly (readonly unknown[])[], firstLine = 1): ParsedRow[] {
  const out: ParsedRow[] = [];
  rows.forEach((cells, i) => {
    const [term, definition, example] = [0, 1, 2].map((j) => cellText(cells[j]));
    if (!term && !definition && !example) return;
    const raw = [term, definition, example].filter(Boolean).join(' | ');
    out.push(makeRow(firstLine + i, raw, term, definition, example));
  });
  return out;
}

const HEADER_WORDS = new Set([
  'english', 'ingilizce', 'eng', 'en',
  'turkish', 'türkçe', 'turkce', 'tr',
  'term', 'terim', 'kelime', 'sözcük',
  'definition', 'tanım', 'tanim', 'anlam', 'anlamı', 'meaning', 'translation', 'çeviri', 'karşılık',
  'example', 'örnek', 'ornek', 'örnek cümle', 'sentence', 'cümle', 'example sentence',
]);

/** İlk satırın başlık gibi görünüp görünmediği. Sadece varsayılan öneri; kullanıcı değiştirebilir. */
export function looksLikeHeader(cells: readonly unknown[]): boolean {
  const filled = cells
    .slice(0, 3)
    .map((c) => cellText(c).toLocaleLowerCase('tr').replace(/[:.*]/g, '').trim())
    .filter(Boolean);
  return filled.length > 0 && filled.every((c) => HEADER_WORDS.has(c));
}

/** Kayıtlı veya listede daha önce geçen kelimeler için uyarı ekler. Hatalı satırlar karşılaştırılmaz. */
export function buildPreview(rows: readonly ParsedRow[], existing: ReadonlySet<string>): PreviewRow[] {
  const seen = new Map<string, number>();
  return rows.map((row) => {
    if (row.error) return row;
    const key = normalizeTerm(row.term);
    if (existing.has(key)) return { ...row, warning: 'Bu kelime zaten kayıtlı' };
    const first = seen.get(key);
    if (first !== undefined) return { ...row, warning: `Bu listede ${first}. satırda da var` };
    seen.set(key, row.line);
    return row;
  });
}
