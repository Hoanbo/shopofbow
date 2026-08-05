import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ContactProvider } from './context/ContactContext'
import { ToastProvider } from './components/Toast'
import './index.css'

const app = (
  <ToastProvider>
    <ContactProvider>
      <App />
    </ContactProvider>
  </ToastProvider>
);

ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? <React.StrictMode>{app}</React.StrictMode> : app
);
