import { useState } from 'react';
import { BookOpen, Box, Settings as SettingsIcon } from 'lucide-react';
import { useSettings } from './hooks/useSettings';
import { FreePlayPage } from './pages/FreePlayPage';
import { NotationPage, SettingsPage } from './pages/SettingsAndNotation';

type Route = 'freePlay' | 'notation' | 'settings';

const ROUTES: readonly { id: Route; icon: typeof Box; label: (t: ReturnType<typeof useSettings>['t']) => string }[] = [
  { id: 'freePlay', icon: Box, label: (t) => t.nav.freePlay },
  { id: 'notation', icon: BookOpen, label: (t) => t.nav.notation },
  { id: 'settings', icon: SettingsIcon, label: (t) => t.settings.title },
];

export function App() {
  const { settings, t, update, resetAll, storageError, corrupt } = useSettings();
  const [route, setRoute] = useState<Route>('freePlay');

  return (
    <div className="app">
      <nav className="sidebar" aria-label={t.appName}>
        <div className="brand">{t.appName}</div>
        {ROUTES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            className={`nav-link ${route === id ? 'active' : ''}`}
            aria-current={route === id ? 'page' : undefined}
            onClick={() => setRoute(id)}
          >
            <Icon size={20} aria-hidden="true" />
            <span>{label(t)}</span>
          </button>
        ))}
      </nav>

      <main className="main" id="main">
        {corrupt && (
          <div className="notice" role="status" style={{ marginBottom: 16 }}>
            {t.errors.corruptSettings}
          </div>
        )}
        {storageError && (
          <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
            {t.errors.storage}
          </div>
        )}

        {/* Giữ trang luyện tập luôn mount để trạng thái khối không mất khi chuyển trang. */}
        <div hidden={route !== 'freePlay'}>
          <FreePlayPage t={t} settings={settings} />
        </div>
        {route === 'notation' && <NotationPage t={t} lang={settings.lang} />}
        {route === 'settings' && (
          <SettingsPage t={t} settings={settings} update={update} resetAll={resetAll} />
        )}
      </main>
    </div>
  );
}
