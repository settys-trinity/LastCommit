import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/400.css'
import '@fontsource/jetbrains-mono/700.css'
import './index.css'
import App from './App.tsx'
import { Landing } from './components/landing/Landing'
import { TEXT_MODE } from './theme'

document.documentElement.dataset.text = TEXT_MODE

// "/demo" is the app; "/" and any other path is the landing page (app/vercel.json rewrites to index.html).
const isDemo = window.location.pathname.replace(/\/+$/, '') === '/demo'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isDemo ? <App /> : <Landing />}
  </StrictMode>,
)
