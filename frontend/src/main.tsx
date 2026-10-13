import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { useAplikasi } from './store/aplikasi'
import './index.css'

const akar = document.getElementById('root')
if (!akar) throw new Error('Elemen #root tidak ditemukan di index.html')

// Muat ulang halaman tidak melepas login sungguhan: sesi di tab ini dipulihkan dari server.
void useAplikasi.getState().pulihkanSesiServer()
void useAplikasi.getState().muatPesananMasuk()

createRoot(akar).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
