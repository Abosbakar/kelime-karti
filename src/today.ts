// "Bugün"ün tek kaynağı. Dev modda tarih simüle edilebilir (SPEC §4); üretimde her zaman gerçek yerel tarih.

import { addDays, todayLocal } from './dates';

const KEY = 'dev.simulatedToday';

export function getSimulatedToday(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    const v = localStorage.getItem(KEY);
    if (!v) return null;
    addDays(v, 0); // geçersizse hata fırlatır
    return v;
  } catch {
    return null;
  }
}

export function setSimulatedToday(date: string | null): void {
  if (!import.meta.env.DEV) return;
  try {
    if (date) localStorage.setItem(KEY, date);
    else localStorage.removeItem(KEY);
  } catch {
    // depolama kapalıysa simülasyon kaydedilemez; yok sayılır
  }
}

export function getToday(): string {
  return getSimulatedToday() ?? todayLocal();
}
