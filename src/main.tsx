import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './context/AppContext';
import { hydrateFromSupabase } from './services/db';
import './index.css';

// Load the durable data from Supabase BEFORE first paint. If the database is
// empty this seeds it once and stores it permanently; if it already has data,
// the real (users, grades, attendance, messages, ...) is restored. The app is
// only rendered once this finishes, so what you see is always the persisted
// state — never a stale in-memory reset.
hydrateFromSupabase().finally(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <AppProvider>
        <App />
      </AppProvider>
    </React.StrictMode>,
  );
});
