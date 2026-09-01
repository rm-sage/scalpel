import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RadialMenu } from './RadialMenu'
import '../styles.css'
import { bootstrapTheme } from '../shared/apply-theme'
import { DiagnosticErrorBoundary, installRendererDiagnostics } from '../shared/diagnostics'
import { bootstrapLocale, bootstrapLocaleSync, LocaleProvider } from '../shared/locale'

bootstrapLocaleSync()
void bootstrapLocale()
void bootstrapTheme()
installRendererDiagnostics('radial-menu')

const root = document.getElementById('root')!
createRoot(root).render(
  <StrictMode>
    <DiagnosticErrorBoundary source="radial-menu">
      <LocaleProvider>
        <RadialMenu />
      </LocaleProvider>
    </DiagnosticErrorBoundary>
  </StrictMode>,
)
