import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.jsx'
import './index.css'
import { ThemeProvider } from './context/ThemeContext.jsx'

import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext.jsx'
import { PlayerProvider } from './context/PlayerContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <AuthProvider>
        <ThemeProvider>
          <ToastProvider>
            <PlayerProvider>
              <BrowserRouter>
                <App />
              </BrowserRouter>
            </PlayerProvider>
          </ToastProvider>
        </ThemeProvider>
      </AuthProvider>
    </HelmetProvider>
  </React.StrictMode>,
)
