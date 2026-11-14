import { lazy, StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import { Landing } from './components/landing/Landing'
import { TEXT_MODE } from './theme'

document.documentElement.dataset.text = TEXT_MODE

// The app (Recharts, engine) loads in its own chunk so the landing page stays small.
const App = lazy(() => import('./App.tsx'))

// "/demo" is the app; "/" and any other path is the landing page (app/vercel.json rewrites to index.html).
const isDemo = window.location.pathname.replace(/\/+$/, '') === '/demo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDemo ? (
      <Suspense fallback={<div className="p-2 text-dim">loading farside demo...</div>}>
        <App />
      </Suspense>
    ) : (
      <Landing />
    )}
  </StrictMode>,
)
