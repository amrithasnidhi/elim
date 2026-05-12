import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Sentry error monitoring — only activates when VITE_SENTRY_DSN is set
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  import('@sentry/react').then(({ init, browserTracingIntegration }) => {
    init({
      dsn: sentryDsn,
      environment: import.meta.env.MODE,
      tracesSampleRate: 0.2,
      integrations: [browserTracingIntegration()],
    })
  }).catch(() => {
    // @sentry/react not installed — run npm install to enable
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
