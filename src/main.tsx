import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { hydrateFromSupabase } from './services/db';
import './index.css';

/**
 * App shell that renders IMMEDIATELY (so the user never stares at a blank
 * screen) and hydrates the durable Supabase data in the background. Once
 * hydration finishes, the app remounts (via the key below) so every component
 * re-reads the now-hydrated `db` — the in-memory seed flashes for a moment at
 * most, then the real persisted state (users, grades, the master prompt,
 * base files, jobs, …) is shown. This replaces the old blocking "hydrate then
 * render" which left a blank page while the sequential Supabase fetch ran.
 */
function AppWithHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hydrateFromSupabase()
      .catch(() => {}) // hydrate is best-effort; the app already has the seed
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <AppProvider>
      {/* Remount once hydrated so all useState initializers re-read the db. */}
      <div key={hydrated ? 'hydrated' : 'initial'}>
        <App />
      </div>
    </AppProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppWithHydration />
  </React.StrictMode>,
);
