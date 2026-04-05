import '../styles/globals.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import SettingsApp from './App'
import { I18nProvider } from '../contexts/I18nContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <SettingsApp />
    </I18nProvider>
  </React.StrictMode>
)
