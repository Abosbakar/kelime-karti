// JSON yedek biçimi ve doğrulaması. İçe aktarılan dosya güvenilmez kabul edilir; her alan kontrol edilir.

import { addDays } from './dates';
import { MAX_STAGE } from './scheduler';
import { MODES, type Card, type Meta, type PoolDecision, type PoolSettings, type Progress, type ReviewLog } from './types';

export const BACKUP_APP = 'kelime-karti';
/** 2: hazır havuz kararları ve ayarları eklendi. 1. sürüm yedekler de okunur. */
export const BACKUP_VERSION = 2;

export interface Backup {
  app: typeof BACKUP_APP;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  cards: Card[];
  logs: ReviewLog[];
  meta: Meta | null;
  poolDecisions: PoolDecision[];
  poolSettings: PoolSettings[];
}

export function makeBackup(
  cards: Card[],
  logs: (ReviewLog & { id?: number })[],
  meta: Meta | null,
  exportedAt: string,
  poolDecisions: PoolDecision[] = [],
  poolSettings: PoolSettings[] = [],
): Backup {
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt,
    cards,
    logs: logs.map(({ cardId, mode, date, checkStage, result }) => ({ cardId, mode, date, checkStage, result })),
    meta,
    poolDecisions: poolDecisions.map(({ poolId, term, decision, date, cardId }) =>
      cardId ? { poolId, term, decision, date, cardId } : { poolId, term, decision, date },
    ),
    poolSettings: poolSettings.map(({ poolId, dailyGoal, startedDate }) => ({ poolId, dailyGoal, startedDate })),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function isDate(v: unknown): v is string {
  if (!isStr(v)) return false;
  try {
    addDays(v, 0);
    return true;
  } catch {
    return false;
  }
}

function isProgress(v: unknown): v is Progress {
  return (
    isObj(v) &&
    Number.isInteger(v.stage) &&
    (v.stage as number) >= 0 &&
    (v.stage as number) <= MAX_STAGE &&
    isDate(v.anchorDate) &&
    v.mastered === (v.stage === MAX_STAGE)
  );
}

function cardError(v: unknown): string | null {
  if (!isObj(v)) return 'kart değil';
  if (!isStr(v.id) || !v.id) return 'id eksik';
  if (!isStr(v.term) || !v.term.trim()) return 'İngilizce kelime boş';
  if (!isStr(v.definition) || !v.definition.trim()) return 'Türkçe anlam boş';
  if (v.example !== undefined && !isStr(v.example)) return 'örnek cümle metin değil';
  if (!isDate(v.createdDate)) return 'geçersiz eklenme tarihi';
  if (!isObj(v.progress)) return 'ilerleme bilgisi yok';
  for (const m of MODES) if (!isProgress(v.progress[m])) return `geçersiz ilerleme (${m})`;
  if (v.source !== undefined && !isStr(v.source)) return 'kaynak metin değil';
  return null;
}

function isPoolDecision(v: unknown): v is PoolDecision {
  return (
    isObj(v) &&
    isStr(v.poolId) &&
    isStr(v.term) &&
    (v.decision === 'known' || v.decision === 'learn') &&
    isDate(v.date) &&
    (v.cardId === undefined || isStr(v.cardId))
  );
}

function isPoolSettings(v: unknown): v is PoolSettings {
  return (
    isObj(v) &&
    isStr(v.poolId) &&
    Number.isInteger(v.dailyGoal) &&
    (v.dailyGoal as number) >= 1 &&
    isDate(v.startedDate)
  );
}

function isLog(v: unknown): v is ReviewLog {
  return (
    isObj(v) &&
    isStr(v.cardId) &&
    MODES.includes(v.mode as never) &&
    isDate(v.date) &&
    Number.isInteger(v.checkStage) &&
    (v.checkStage as number) >= 1 &&
    (v.checkStage as number) <= MAX_STAGE &&
    ['correct', 'wrong', 'missed'].includes(v.result as string)
  );
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; errors: string[] };

const MAX_ERRORS = 20;

export function parseBackup(data: unknown): ParseResult {
  if (!isObj(data) || data.app !== BACKUP_APP || !Array.isArray(data.cards) || !Array.isArray(data.logs)) {
    return { ok: false, errors: ['Bu dosya bir Kelime Kartı yedeği değil'] };
  }
  if (data.version !== 1 && data.version !== BACKUP_VERSION) {
    return { ok: false, errors: [`Desteklenmeyen yedek sürümü: ${String(data.version)}`] };
  }
  const poolDecisions = data.version === 1 ? [] : data.poolDecisions;
  const poolSettings = data.version === 1 ? [] : data.poolSettings;
  if (!Array.isArray(poolDecisions) || !Array.isArray(poolSettings)) {
    return { ok: false, errors: ['Havuz bilgileri eksik'] };
  }

  const errors: string[] = [];
  const ids = new Set<string>();
  data.cards.forEach((c, i) => {
    const e = cardError(c);
    if (e) errors.push(`Kart ${i + 1}: ${e}`);
    else if (ids.has((c as Card).id)) errors.push(`Kart ${i + 1}: aynı id iki kez var (${(c as Card).id})`);
    else ids.add((c as Card).id);
  });
  data.logs.forEach((l, i) => {
    if (!isLog(l)) errors.push(`Kayıt ${i + 1}: geçersiz cevap kaydı`);
  });
  poolDecisions.forEach((d, i) => {
    if (!isPoolDecision(d)) errors.push(`Havuz kararı ${i + 1}: geçersiz`);
  });
  poolSettings.forEach((s, i) => {
    if (!isPoolSettings(s)) errors.push(`Havuz ayarı ${i + 1}: geçersiz`);
  });
  const meta = data.meta;
  if (meta !== null && !(isObj(meta) && isDate(meta.lastProcessedDate))) errors.push('Meta bilgisi geçersiz');

  if (errors.length) {
    const extra = errors.length - MAX_ERRORS;
    return { ok: false, errors: extra > 0 ? [...errors.slice(0, MAX_ERRORS), `…ve ${extra} hata daha`] : errors };
  }

  // Yalnızca bilinen alanları al; dosyadaki fazlalıklar veritabanına girmesin.
  const cards: Card[] = (data.cards as Card[]).map((c) => {
    const card: Card = {
      id: c.id,
      term: c.term,
      definition: c.definition,
      createdDate: c.createdDate,
      progress: {
        recognition: pickProgress(c.progress.recognition),
        writing: pickProgress(c.progress.writing),
      },
    };
    if (c.example) card.example = c.example;
    if (c.source) card.source = c.source;
    return card;
  });
  return {
    ok: true,
    backup: makeBackup(
      cards,
      data.logs as ReviewLog[],
      meta ? { lastProcessedDate: (meta as Meta).lastProcessedDate } : null,
      isStr(data.exportedAt) ? data.exportedAt : '',
      poolDecisions as PoolDecision[],
      poolSettings as PoolSettings[],
    ),
  };
}

const pickProgress = ({ stage, anchorDate, mastered }: Progress): Progress => ({ stage, anchorDate, mastered });
