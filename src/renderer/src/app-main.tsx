import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AppWindow } from './AppWindow'
import './styles.css'
import { bootstrapTheme } from './shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from './shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from './shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('app')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="app">
      <LocaleProvider>
        <AppWindow />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
