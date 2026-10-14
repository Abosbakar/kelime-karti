// Hazır kelime havuzları. Veriler src/pools/<id>.json içinde [İngilizce, Türkçe] çiftleri olarak durur ve
// yalnızca havuz açılınca yüklenir (her biri ayrı parça; service worker çevrimdışı için önbelleğe alır).

import { normalizeTerm } from './importParse';
import type { PoolDecision } from './types';

export type PoolWord = [term: string, definition: string];

export interface PoolMeta {
  id: string;
  name: string;
  group: 'cefr' | 'exam';
  description: string;
}

export const POOLS: readonly PoolMeta[] = [
  { id: 'a1', name: 'A1', group: 'cefr', description: 'Başlangıç: günlük hayatın temel kelimeleri' },
  { id: 'a2', name: 'A2', group: 'cefr', description: 'Temel: alışveriş, yolculuk, iş, sağlık' },
  { id: 'b1', name: 'B1', group: 'cefr', description: 'Orta: fikir bildirme, deneyim anlatma' },
  { id: 'b2', name: 'B2', group: 'cefr', description: 'Orta üstü: tartışma, haber, iş dünyası' },
  { id: 'c1', name: 'C1', group: 'cefr', description: 'İleri: akademik ve soyut kavramlar' },
  { id: 'c2', name: 'C2', group: 'cefr', description: 'Ustalık: nadir ve incelikli kelimeler' },
  { id: 'yokdil-saglik', name: 'YÖKDİL Sağlık', group: 'exam', description: 'Tıp, hastalık, tedavi ve araştırma terimleri' },
  { id: 'yokdil-fen', name: 'YÖKDİL Fen', group: 'exam', description: 'Fizik, kimya, biyoloji, mühendislik, çevre' },
  { id: 'yokdil-sosyal', name: 'YÖKDİL Sosyal', group: 'exam', description: 'Tarih, siyaset, ekonomi, psikoloji, sosyoloji' },
  { id: 'yds', name: 'YDS', group: 'exam', description: 'Sınavda sık çıkan akademik fiil, sıfat ve isimler' },
  { id: 'yds2500', name: 'YDS 2500', group: 'exam', description: '2500 kelimelik YDS listesi, edatlarıyla birlikte' },
];

export const poolById = (id: string) => POOLS.find((p) => p.id === id);

const loaders = import.meta.glob<PoolWord[]>('./pools/*.json', { import: 'default' });

export async function loadPool(id: string): Promise<PoolWord[]> {
  const load = loaders[`./pools/${id}.json`];
  if (!load) throw new Error(`Havuz bulunamadı: ${id}`);
  return load();
}

export interface PoolProgress {
  total: number;
  known: number;
  learning: number;
  addedToday: number;
  /** Havuz dışından (elle) zaten eklenmiş olduğu için atlanan kelimeler. */
  alreadyHave: number;
  /** Henüz karar verilmemiş kelimeler (havuz sırasıyla). */
  remaining: PoolWord[];
}

/**
 * `existing`: kayıtlı tüm kartların normalize edilmiş kelimeleri. Havuzdan öğrenmeye alınanlar da
 * burada olur; onlar karar kaydından tanınır ve "zaten var" sayılmaz.
 */
export function poolProgress(
  words: readonly PoolWord[],
  decisions: readonly PoolDecision[],
  existing: ReadonlySet<string>,
  today: string,
): PoolProgress {
  const decided = new Map(decisions.map((d) => [d.term, d]));
  let known = 0;
  let learning = 0;
  let addedToday = 0;
  let alreadyHave = 0;
  const remaining: PoolWord[] = [];
  for (const w of words) {
    const d = decided.get(w[0]);
    if (d?.decision === 'known') known++;
    else if (d?.decision === 'learn') {
      learning++;
      if (d.date === today) addedToday++;
    } else if (existing.has(normalizeTerm(w[0]))) alreadyHave++;
    else remaining.push(w);
  }
  return { total: words.length, known, learning, addedToday, alreadyHave, remaining };
}
