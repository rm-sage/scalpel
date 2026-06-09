import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PoeVersionRoot } from '../shared/PoeVersionRoot'
import { App } from './App'
import '../styles.css'
import { bootstrapTheme } from '../shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('cheat-sheets')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="cheat-sheets">
      <LocaleProvider>
        <PoeVersionRoot>
          <App />
        </PoeVersionRoot>
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
