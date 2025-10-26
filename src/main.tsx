import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { RouterProvider } from './lib/router.tsx';

if (import.meta.env.PROD) {
  import('./analytics/init.ts')
    .then(({ initAnalytics }) => {
      initAnalytics();
    })
    .catch((error) => {
      console.error('Failed to initialize analytics SDKs', error);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider>
      <App />
    </RouterProvider>
  </StrictMode>,
);
