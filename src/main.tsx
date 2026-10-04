import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import BgmPlayer from './components/BgmPlayer'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <BgmPlayer />
  </StrictMode>,
)
