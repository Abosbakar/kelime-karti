import { useEffect, useState } from 'react';
import { DevPanel } from './DevPanel';
import { Icon, type IconName } from './Icon';
import { AddPage } from './pages/AddPage';
import { CardsPage } from './pages/CardsPage';
import { HomePage } from './pages/HomePage';
import { PoolSessionPage } from './pages/PoolSessionPage';
import { PoolsPage } from './pages/PoolsPage';
import { ProgressPage } from './pages/ProgressPage';
import { SettingsPage } from './pages/SettingsPage';
import { PwaStatus } from './PwaStatus';
import { StudyPage } from './study/StudyPage';
import { MODES } from './types';
import { useToday } from './useToday';

const NAV: { hash: string; label: string; icon: IconName; center?: boolean }[] = [
  { hash: '#/', label: 'Bugün', icon: 'home' },
  { hash: '#/havuzlar', label: 'Havuzlar', icon: 'pools' },
  { hash: '#/ekle', label: 'Ekle', icon: 'plus', center: true },
  { hash: '#/kartlar', label: 'Kartlar', icon: 'cards' },
  { hash: '#/ilerleme', label: 'İlerleme', icon: 'chart' },
];

const TITLES: Record<string, string> = {
  '#/havuzlar': 'Kelime havuzları',
  '#/ekle': 'Kart ekle',
  '#/kartlar': 'Kartlar',
  '#/ilerleme': 'İlerleme',
  '#/ayarlar': 'Ayarlar',
};

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash || '#/');
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash || '#/');
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return hash;
}

export default function App() {
  const { today, ready, error, refresh } = useToday();
  const hash = useHash();
  const studyMode = MODES.find((m) => hash === `#/calis/${m}`);
  const poolId = hash.startsWith('#/havuz/') ? hash.slice('#/havuz/'.length) : null;
  const showNav = !studyMode;

  // Alt menünün kapladığı boşluk yalnızca menü görünürken bırakılır.
  useEffect(() => {
    document.getElementById('root')?.classList.toggle('no-nav', !showNav);
  }, [showNav]);

  function page() {
    if (studyMode) return <StudyPage key={studyMode} mode={studyMode} today={today} />;
    if (poolId) return <PoolSessionPage key={poolId} poolId={poolId} today={today} />;
    switch (hash) {
      case '#/havuzlar':
        return <PoolsPage today={today} />;
      case '#/ekle':
        return <AddPage today={today} />;
      case '#/kartlar':
        return <CardsPage />;
      case '#/ilerleme':
        return <ProgressPage today={today} />;
      case '#/ayarlar':
        return <SettingsPage today={today} />;
      default:
        return <HomePage today={today} />;
    }
  }

  const title = TITLES[hash];

  return (
    <>
      {title && (
        <header className="app-bar">
          <h1 className="title">{title}</h1>
          <div className="actions-right">
            {hash !== '#/ayarlar' && (
              <a className="icon-btn" href="#/ayarlar" aria-label="Ayarlar">
                <Icon name="gear" size={20} />
              </a>
            )}
          </div>
        </header>
      )}
      {error && <p role="alert" className="error-text">Veri işlenemedi: {error}</p>}
      {ready ? page() : !error && <p>Yükleniyor…</p>}
      {import.meta.env.DEV && <DevPanel today={today} onChange={refresh} />}
      {showNav && (
        <nav className="bottom-nav" aria-label="Ana menü">
          <div className="inner">
            {NAV.map((n) => {
              const active = hash === n.hash || (n.hash === '#/havuzlar' && !!poolId);
              return (
                <a key={n.hash} href={n.hash} className={n.center ? 'center' : undefined} aria-current={active ? 'page' : undefined}>
                  <span className={n.center ? 'bubble' : undefined}>
                    <Icon name={n.icon} size={n.center ? 24 : 22} strokeWidth={n.center ? 2.4 : 2} />
                  </span>
                  <span>{n.label}</span>
                </a>
              );
            })}
          </div>
        </nav>
      )}
      <PwaStatus />
    </>
  );
}
