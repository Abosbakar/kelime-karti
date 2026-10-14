import { normalizeTerm, stripNotes } from './importParse';

/**
 * Kartın İngilizce tarafında `/` ile ayrılmış alternatifler (ör. "big / large"). Parantez içi
 * notlar (edatlar) cevaba dahil değildir; içlerindeki `/` alternatif sayılmaz.
 */
export function acceptedAnswers(term: string): string[] {
  return stripNotes(term)
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Yazım modu: büyük/küçük harf duyarsız, boşluklar kırpılmış; alternatiflerden biri veya tamamı kabul. */
export function checkAnswer(input: string, term: string): boolean {
  const given = normalizeTerm(input);
  if (!given) return false;
  return given === normalizeTerm(term) || acceptedAnswers(term).some((a) => normalizeTerm(a) === given);
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
