// Veritabanı işlemleri. Zamanlama kuralları scheduler.ts'te; burası yalnızca okur, uygular ve yazar.

import { makeBackup, type Backup } from './backup';
import type { AppDB } from './db';
import { addDays } from './dates';
import { normalizeTerm } from './importParse';
import { applyReview, isDue, newCard, processMissedDays, reviewCard } from './scheduler';
import type { PoolWord } from './pools';
import type { Card, Meta, Mode, PoolDecision, Progress, ReviewLog, ReviewResult } from './types';

export async function getMeta(db: AppDB): Promise<Meta | undefined> {
  const row = await db.meta.get('main');
  return row && { lastProcessedDate: row.lastProcessedDate };
}

/** Kaçırılan günleri kapatır. Transaction içinden çağrılmalı. */
async function closeMissedDays(db: AppDB, today: string): Promise<ReviewLog[]> {
  const meta = await db.meta.get('main');
  if (!meta) {
    // İlk açılış: geçmişte kapatılacak gün yok.
    await db.meta.put({ key: 'main', lastProcessedDate: addDays(today, -1) });
    return [];
  }
  if (meta.lastProcessedDate >= addDays(today, -1)) return [];

  const cards = await db.cards.toArray();
  const r = processMissedDays(cards, meta.lastProcessedDate, today);
  const changed = r.cards.filter((c, i) => c !== cards[i]);
  if (changed.length) await db.cards.bulkPut(changed);
  if (r.logs.length) await db.logs.bulkAdd(r.logs);
  await db.meta.put({ key: 'main', lastProcessedDate: r.lastProcessedDate });
  return r.logs;
}

/** Uygulama açılışında (ve gün değiştiğinde) çağrılır. */
export async function processDays(db: AppDB, today: string): Promise<{ logs: ReviewLog[] }> {
  const logs = await db.transaction('rw', db.cards, db.logs, db.meta, () => closeMissedDays(db, today));
  return { logs };
}

export interface AnswerOutcome {
  card: Card;
  mode: Mode;
  previous: Progress; // cevaptan önceki durum ("Aslında doğruydu" için)
  logId: number;
}

/** Cevabı anında kaydeder. Uygulama gece yarısını geçerek açık kaldıysa önce dünü kapatır. */
export async function answerCard(
  db: AppDB,
  cardId: string,
  mode: Mode,
  result: ReviewResult,
  today: string,
): Promise<AnswerOutcome> {
  return db.transaction('rw', db.cards, db.logs, db.meta, async () => {
    await closeMissedDays(db, today);
    const card = await db.cards.get(cardId);
    if (!card) throw new Error(`Kart bulunamadı: ${cardId}`);
    if (!isDue(card.progress[mode], today)) {
      throw new Error('Bu kart bugün bu modda sorulacak kartlardan değil');
    }
    const r = reviewCard(card, mode, result, today);
    await db.cards.put(r.card);
    const logId = (await db.logs.add(r.log)) as number;
    return { card: r.card, mode, previous: card.progress[mode], logId };
  });
}

/**
 * Yazım hatası: bugün verilen yanlış cevabı doğruya çevirir. Kart, o cevap hiç verilmemiş
 * ve doğru bilinmiş gibi olur. Arada kart değiştiyse (ör. ikinci kez çağrı) hata verir.
 */
export async function markActuallyCorrect(db: AppDB, outcome: AnswerOutcome, today: string): Promise<Card> {
  const { mode, previous, logId } = outcome;
  return db.transaction('rw', db.cards, db.logs, async () => {
    const [card, log] = await Promise.all([db.cards.get(outcome.card.id), db.logs.get(logId)]);
    if (!card || !log) throw new Error('Kart veya cevap kaydı bulunamadı');
    if (log.cardId !== card.id || log.mode !== mode || log.result !== 'wrong' || log.date !== today) {
      throw new Error('Sadece bugün verilen yanlış cevap düzeltilebilir');
    }
    const expected = applyReview(previous, 'wrong', today);
    const current = card.progress[mode];
    if (
      current.stage !== expected.stage ||
      current.anchorDate !== expected.anchorDate ||
      current.mastered !== expected.mastered
    ) {
      throw new Error('Kart bu cevaptan sonra değişmiş');
    }
    const fixed: Card = { ...card, progress: { ...card.progress, [mode]: applyReview(previous, 'correct', today) } };
    await db.cards.put(fixed);
    await db.logs.update(logId, { result: 'correct' });
    return fixed;
  });
}

export interface NewCardInput {
  term: string;
  definition: string;
  example?: string;
  source?: string;
}

// randomUUID yalnızca güvenli bağlamda (https/localhost) var; telefonda LAN üzerinden http testinde yok.
function makeId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function buildCard(input: NewCardInput, today: string): Card {
  const term = input.term.trim();
  const definition = input.definition.trim();
  if (!term || !definition) throw new Error('İngilizce kelime ve Türkçe anlam boş olamaz');
  const card = newCard({
    id: makeId(),
    term,
    definition,
    example: input.example?.trim() || undefined,
    createdDate: today,
  });
  if (input.source) card.source = input.source;
  return card;
}

export async function addCard(db: AppDB, input: NewCardInput, today: string): Promise<Card> {
  const card = buildCard(input, today);
  await db.cards.add(card);
  return card;
}

/** Toplu ekleme: ya hepsi kaydedilir ya hiçbiri. */
export async function addCards(db: AppDB, inputs: readonly NewCardInput[], today: string): Promise<Card[]> {
  const cards = inputs.map((i) => buildCard(i, today));
  await db.cards.bulkAdd(cards);
  return cards;
}

/** Metni düzenler; eklenme tarihi ve ilerleme korunur. */
export async function updateCard(db: AppDB, id: string, input: NewCardInput): Promise<Card> {
  const term = input.term.trim();
  const definition = input.definition.trim();
  if (!term || !definition) throw new Error('İngilizce kelime ve Türkçe anlam boş olamaz');
  return db.transaction('rw', db.cards, async () => {
    const card = await db.cards.get(id);
    if (!card) throw new Error(`Kart bulunamadı: ${id}`);
    const { example: _, ...rest } = card;
    const updated: Card = { ...rest, term, definition };
    const example = input.example?.trim();
    if (example) updated.example = example;
    await db.cards.put(updated);
    return updated;
  });
}

/** Kartı geçmişiyle siler. Havuzdan geldiyse havuz kararı da silinir; kelime havuza geri döner. */
export async function deleteCard(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.poolDecisions, async () => {
    const card = await db.cards.get(id);
    await db.logs.where('cardId').equals(id).delete();
    if (card?.source) {
      await db.poolDecisions.where('poolId').equals(card.source).filter((d) => d.cardId === id).delete();
    }
    await db.cards.delete(id);
  });
}

export async function exportBackup(db: AppDB, exportedAt: string): Promise<Backup> {
  return db.transaction('r', [db.cards, db.logs, db.meta, db.poolDecisions, db.poolSettings], async () =>
    makeBackup(
      await db.cards.toArray(),
      await db.logs.toArray(),
      (await getMeta(db)) ?? null,
      exportedAt,
      await db.poolDecisions.toArray(),
      await db.poolSettings.toArray(),
    ),
  );
}

/** Tüm veriyi yedektekiyle değiştirir, ardından yedekten bu yana geçen günleri işler. */
export async function importBackup(db: AppDB, backup: Backup, today: string): Promise<{ missed: number }> {
  const tables = [db.cards, db.logs, db.meta, db.poolDecisions, db.poolSettings];
  return db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((t) => t.clear()));
    await db.cards.bulkAdd(backup.cards);
    await db.logs.bulkAdd(backup.logs);
    await db.poolDecisions.bulkAdd(backup.poolDecisions);
    await db.poolSettings.bulkAdd(backup.poolSettings);
    if (backup.meta) await db.meta.put({ key: 'main', ...backup.meta });
    const missed = await closeMissedDays(db, today);
    return { missed: missed.length };
  });
}

// ---- Hazır havuzlar ----

export async function setPoolGoal(db: AppDB, poolId: string, dailyGoal: number, today: string): Promise<void> {
  if (!Number.isInteger(dailyGoal) || dailyGoal < 1 || dailyGoal > 200) {
    throw new Error('Günlük hedef 1 ile 200 arasında bir sayı olmalı');
  }
  await db.transaction('rw', db.poolSettings, async () => {
    const prev = await db.poolSettings.get(poolId);
    await db.poolSettings.put({ poolId, dailyGoal, startedDate: prev?.startedDate ?? today });
  });
}

/**
 * Havuzdaki kelime için karar: "biliyorum" yalnızca kaydedilir; "öğrenmeliyim" bugünün tarihiyle kart
 * oluşturur. Bugün eklenenler günlük hedefe ulaştıysa yeni kelime eklenmez.
 */
export async function decidePoolWord(
  db: AppDB,
  poolId: string,
  [term, definition]: PoolWord,
  decision: PoolDecision['decision'],
  today: string,
): Promise<PoolDecision> {
  return db.transaction('rw', db.cards, db.poolDecisions, db.poolSettings, async () => {
    const settings = await db.poolSettings.get(poolId);
    if (!settings) throw new Error('Önce günlük hedefi belirleyerek havuzu başlat');
    if (await db.poolDecisions.get([poolId, term])) throw new Error(`"${term}" için zaten karar verildi`);

    const record: PoolDecision = { poolId, term, decision, date: today };
    if (decision === 'learn') {
      const addedToday = await db.poolDecisions
        .where('[poolId+date]')
        .equals([poolId, today])
        .filter((d) => d.decision === 'learn')
        .count();
      if (addedToday >= settings.dailyGoal) throw new Error('Bugünkü hedef doldu');
      if ((await getExistingTerms(db)).has(normalizeTerm(term))) throw new Error(`"${term}" kartlarında zaten var`);
      const card = buildCard({ term, definition, source: poolId }, today);
      await db.cards.add(card);
      record.cardId = card.id;
    }
    await db.poolDecisions.add(record);
    return record;
  });
}

/** Bugün verilen kararı geri alır; "öğrenmeliyim" ise oluşturulan kart (henüz çalışılmadıysa) silinir. */
export async function undoPoolDecision(db: AppDB, poolId: string, term: string, today: string): Promise<void> {
  await db.transaction('rw', db.cards, db.logs, db.poolDecisions, async () => {
    const d = await db.poolDecisions.get([poolId, term]);
    if (!d) throw new Error('Geri alınacak karar bulunamadı');
    if (d.date !== today) throw new Error('Sadece bugün verilen karar geri alınabilir');
    if (d.cardId) {
      if (await db.logs.where('cardId').equals(d.cardId).count()) throw new Error('Bu kart çalışılmış, geri alınamaz');
      await db.cards.delete(d.cardId);
    }
    await db.poolDecisions.delete([poolId, term]);
  });
}

/** Tekrar uyarısı için kayıtlı kelimeler (normalize edilmiş). */
export async function getExistingTerms(db: AppDB): Promise<Set<string>> {
  const terms = (await db.cards.orderBy('term').keys()) as string[];
  return new Set(terms.map(normalizeTerm));
}

export async function getDueCards(db: AppDB, mode: Mode, today: string): Promise<Card[]> {
  const cards = await db.cards.toArray();
  return cards.filter((c) => isDue(c.progress[mode], today));
}
