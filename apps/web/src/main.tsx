import './styles/globals.css'
import './styles/animations.css'
import './styles/skills-workbench.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './contexts/ToastContext'
import { UIProvider } from './contexts/UIContext'
import { TodoProvider } from './contexts/TodoContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <ToastProvider>
        <UIProvider>
          <TodoProvider>
            <ErrorBoundary>
              <App />
            </ErrorBoundary>
          </TodoProvider>
        </UIProvider>
      </ToastProvider>
    </I18nProvider>
  </React.StrictMode>,
)
