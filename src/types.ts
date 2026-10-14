export type Mode = 'recognition' | 'writing';

export const MODES: readonly Mode[] = ['recognition', 'writing'];

export type ReviewResult = 'correct' | 'wrong' | 'missed';

export interface Progress {
  stage: number; // 0..7, geçilen kontrol sayısı
  anchorDate: string; // YYYY-MM-DD, kelimenin "öğrenilmiş sayıldığı" gün
  mastered: boolean; // stage === 7
}

export interface Card {
  id: string;
  term: string; // İngilizce
  definition: string; // Türkçe
  example?: string;
  createdDate: string; // YYYY-MM-DD, değişmez
  progress: Record<Mode, Progress>;
  source?: string; // hazır havuzdan eklendiyse havuz id'si (ör. "b1")
}

/** Hazır havuzdaki bir kelime için kullanıcının kararı. */
export interface PoolDecision {
  poolId: string;
  term: string;
  decision: 'known' | 'learn';
  date: string; // YYYY-MM-DD
  cardId?: string; // 'learn' ise oluşturulan kart
}

export interface PoolSettings {
  poolId: string;
  dailyGoal: number; // günde eklenecek yeni kelime
  startedDate: string;
}

export interface ReviewLog {
  cardId: string;
  mode: Mode;
  date: string;
  checkStage: number; // hangi kontrol (1..7)
  result: ReviewResult;
}

export interface Meta {
  lastProcessedDate: string; // en son "kapatılan" gün
}
