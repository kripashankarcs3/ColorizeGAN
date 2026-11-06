import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Self-hosted display font (all variable axes, so 'opsz' and 'SOFT' work).
import '@fontsource-variable/fraunces/full.css'
import '@fontsource-variable/fraunces/full-italic.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
