import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const akar = document.getElementById('root')
if (!akar) throw new Error('Elemen #root tidak ditemukan di index.html')

createRoot(akar).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
