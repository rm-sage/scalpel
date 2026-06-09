import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import '../styles.css'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
installRendererDiagnostics('cheat-sheet-preview')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="cheat-sheet-preview">
      <LocaleProvider>
        <App />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
