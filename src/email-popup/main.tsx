import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import EmailPopup from './email-popup'

createRoot(document.getElementById('emailPopup')!).render(
  <StrictMode>
    <EmailPopup />
  </StrictMode>,
)
