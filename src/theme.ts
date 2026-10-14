// Tema tercihi cihaza özeldir (localStorage); yedeğe girmez. İlk boyamadan önce index.html'deki
// satır içi betik de aynı anahtarı okur, böylece açılışta beyaz yanıp sönme olmaz.

export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // depolama kapalıysa tercih yalnızca bu oturumda geçerli
  }
  applyTheme(pref);
}

const BAR_COLOR = { light: '#f4f5fb', dark: '#0f1020' } as const;

export function applyTheme(pref: ThemePref): void {
  if (pref === 'system') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = pref;
  // Telefonun üst çubuğu: index.html'deki iki theme-color etiketi sistem temasına göre seçilir;
  // elle seçilen temada ikisi de o temanın rengine çekilir.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const systemScheme = m.media.includes('dark') ? 'dark' : 'light';
    m.content = BAR_COLOR[pref === 'system' ? systemScheme : pref];
  });
}
