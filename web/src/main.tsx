import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted fonts: Newsreader (display, optical sizes) and Public Sans (UI).
import '@fontsource-variable/newsreader/opsz.css'
import '@fontsource-variable/public-sans/wght.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
