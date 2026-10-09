import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './context/LanguageContext'
import './styles/globals.css'

const VITE_API_URL = import.meta.env.VITE_API_URL || '';
document.documentElement.style.setProperty('--restaurant-bg', `url('/assets/images/restaurant_bg.png')`);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)
