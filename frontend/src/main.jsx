import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App.jsx';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: false,
    }),
  ],
  tracesSampleRate: 0.2,       // 20% of sessions traced
  replaysSessionSampleRate: 0.1, // 10% full session replays
  replaysOnErrorSampleRate: 1.0, // 100% replays when error occurs
  enabled: !!import.meta.env.VITE_SENTRY_DSN,
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong. Our team has been notified.</p>} showDialog>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
);
