// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { RouterProvider } from './lib/router';
import { ensureSession } from './app/ensureSession';

const mount = () => {
  const rootEl = document.getElementById('root');
  if (!rootEl) {
    // En environnement natif, mieux vaut hard-fail que rendre silencieusement
    throw new Error('Root element #root introuvable');
  }
  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider>
        <App />
      </RouterProvider>
    </StrictMode>,
  );
};

// Analytics lazy (inchangé)
if (import.meta.env.PROD) {
  import('./analytics/init')
    .then(({ initAnalytics }) => initAnalytics())
    .catch((error) => {
      console.error('Failed to initialize analytics SDKs', error);
    });
}

// Bootstrap auth + rendu
(async () => {
  try {
    // Garantit une session (anonyme si nécessaire) avant tout accès DB/RLS
    await ensureSession();
  } catch (err) {
    // On log et on continue le rendu même si l’anonyme échoue (réseau, etc.)
    console.warn('[bootstrap] ensureSession failed:', err);
  } finally {
    mount();
  }
})();
