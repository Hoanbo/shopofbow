import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ContactProvider } from './context/ContactContext'
import { ToastProvider } from './components/Toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <ContactProvider>
        <App />
      </ContactProvider>
    </ToastProvider>
  </React.StrictMode>,
)
