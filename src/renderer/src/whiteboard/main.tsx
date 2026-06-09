import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Whiteboard } from './index'
import '../styles.css'
import { bootstrapTheme } from '../shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('whiteboard')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="whiteboard">
      <LocaleProvider>
        <Whiteboard />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
