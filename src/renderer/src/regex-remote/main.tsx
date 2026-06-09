import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RegexRemote } from './RegexRemote'
import '../styles.css'
import { bootstrapTheme } from '../shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('regex-remote')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="regex-remote">
      <LocaleProvider>
        <RegexRemote />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
