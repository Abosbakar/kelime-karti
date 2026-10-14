import { describe, expect, it } from 'vitest';
import {
  buildPreview,
  looksLikeHeader,
  normalizeTerm,
  parsePasted,
  parseRows,
  resolveSeparator,
} from './importParse';

describe('ayırıcılar', () => {
  it('hazır seçenekleri çözer', () => {
    expect(resolveSeparator({ kind: 'tab' })).toBe('\t');
    expect(resolveSeparator({ kind: 'comma' })).toBe(',');
    expect(resolveSeparator({ kind: 'newline' })).toBe('\n');
    expect(resolveSeparator({ kind: 'semicolon' })).toBe(';');
  });

  it('özel ayırıcıda \\t ve \\n kaçışlarını tanır, boşsa null döner', () => {
    expect(resolveSeparator({ kind: 'custom', value: ' - ' })).toBe(' - ');
    expect(resolveSeparator({ kind: 'custom', value: '\\t' })).toBe('\t');
    expect(resolveSeparator({ kind: 'custom', value: '\\n\\n' })).toBe('\n\n');
    expect(resolveSeparator({ kind: 'custom', value: '' })).toBeNull();
  });
});

describe('yapıştırma', () => {
  it('varsayılan: tab ve yeni satır, Windows satır sonlarını da kabul eder', () => {
    const rows = parsePasted('apple\telma\r\nbook\tkitap\n\n  \nhouse\tev\n', '\t', '\n');
    expect(rows).toEqual([
      { line: 1, raw: 'apple\telma', term: 'apple', definition: 'elma' },
      { line: 2, raw: 'book\tkitap', term: 'book', definition: 'kitap' },
      { line: 5, raw: 'house\tev', term: 'house', definition: 'ev' },
    ]);
  });

  it('tab ayırıcıda 3. sütun örnek cümledir', () => {
    const [r] = parsePasted('apple\telma\tAn apple a day.', '\t', '\n');
    expect(r).toMatchObject({ term: 'apple', definition: 'elma', example: 'An apple a day.' });
  });

  it('virgül ayırıcıda sadece ilk virgülden böler (tanımda virgül olabilir)', () => {
    const [r] = parsePasted('run, koşmak, çalıştırmak', ',', '\n');
    expect(r).toMatchObject({ term: 'run', definition: 'koşmak, çalıştırmak' });
    expect(r.example).toBeUndefined();
  });

  it('noktalı virgül ve özel ayırıcılarla çalışır', () => {
    const rows = parsePasted('apple - elma; book - kitap;', ' - ', ';');
    expect(rows.map((r) => [r.term, r.definition])).toEqual([
      ['apple', 'elma'],
      ['book', 'kitap'],
    ]);
  });

  it('ayırıcısı veya alanı eksik satırları hatalı işaretler', () => {
    const rows = parsePasted('apple\nbook\t\n\tkitap\nok\ttamam', '\t', '\n');
    expect(rows.map((r) => r.error ?? null)).toEqual([
      'Terim ile tanım arasında ayırıcı yok',
      'Türkçe anlam boş',
      'İngilizce kelime boş',
      null,
    ]);
  });
});

describe('tablo satırları', () => {
  it('1. sütun İngilizce, 2. Türkçe, 3. örnek; sayıları metne çevirir', () => {
    const rows = parseRows([
      ['apple', 'elma', 'An apple a day.'],
      ['', '', ''],
      ['seven', 7],
      ['book', ''],
    ]);
    expect(rows).toEqual([
      { line: 1, raw: 'apple | elma | An apple a day.', term: 'apple', definition: 'elma', example: 'An apple a day.' },
      { line: 3, raw: 'seven | 7', term: 'seven', definition: '7' },
      { line: 4, raw: 'book', term: 'book', definition: '', error: 'Türkçe anlam boş' },
    ]);
  });

  it('başlık satırını tanır', () => {
    expect(looksLikeHeader(['English', 'Turkish'])).toBe(true);
    expect(looksLikeHeader(['İngilizce', 'Türkçe', 'Örnek cümle'])).toBe(true);
    expect(looksLikeHeader(['Kelime', 'Anlam'])).toBe(true);
    expect(looksLikeHeader(['Term', 'Definition'])).toBe(true);
    expect(looksLikeHeader(['apple', 'elma'])).toBe(false);
    expect(looksLikeHeader(['word', 'kelime'])).toBe(false); // gerçek bir kart da olabilir
    expect(looksLikeHeader([])).toBe(false);
  });
});

describe('önizleme', () => {
  it('veritabanında ve listede tekrar eden kelimeleri işaretler', () => {
    const rows = parsePasted('Apple\telma\nbook\tkitap\nBOOK \tdefter\nnew\tyeni\nbad', '\t', '\n');
    const p = buildPreview(rows, new Set([normalizeTerm('apple')]));
    expect(p.map((r) => r.warning ?? null)).toEqual([
      'Bu kelime zaten kayıtlı',
      null,
      'Bu listede 2. satırda da var',
      null,
      null,
    ]);
    expect(p[4].error).toBeDefined();
  });

  it('kelimeleri büyük/küçük harf ve boşluk duyarsız karşılaştırır', () => {
    expect(normalizeTerm('  Hello   World ')).toBe('hello world');
    expect(normalizeTerm('İstanbul')).toBe(normalizeTerm('istanbul'));
  });

  it('parantez içini (edatlar) yok sayar; yalnızca parantezse metni korur', () => {
    expect(normalizeTerm('abound (in/with)')).toBe('abound');
    expect(normalizeTerm('accountable (for/to)')).toBe(normalizeTerm('Accountable'));
    expect(normalizeTerm('(to) run')).toBe('run');
    expect(normalizeTerm('(in)')).toBe('(in)');
  });

  it('edatlı kelimeyi edatsız haliyle aynı sayar', () => {
    const rows = parsePasted('abound\tbol olmak', '\t', '\n');
    expect(buildPreview(rows, new Set([normalizeTerm('abound (in/with)')]))[0].warning).toBe('Bu kelime zaten kayıtlı');
  });
});
