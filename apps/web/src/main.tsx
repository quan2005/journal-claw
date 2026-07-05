import './styles/globals.css'
import './styles/animations.css'
import './styles/skills-workbench.css'
import './styles/workspace.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { BootGate } from './components/BootGate'
import { ErrorBoundary } from './components/ErrorBoundary'
import { I18nProvider } from './contexts/I18nContext'
import { ToastProvider } from './contexts/ToastContext'
import { UIProvider } from './contexts/UIContext'
import { TodoProvider } from './contexts/TodoContext'

// D3: BootGate wraps the entire provider tree. It probes daemon reachability
// before mounting any provider/hook, so during boot no daemon calls fire and
// no error toasts appear. The inline boot-splash in index.html covers the
// pre-React gap; BootGate covers the React-mounted-but-daemon-not-ready gap.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BootGate>
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
    </BootGate>
  </React.StrictMode>,
)
