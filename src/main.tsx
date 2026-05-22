import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App'
import { AuthProvider } from './lib/AuthContext'
import { SafeSyncProvider } from './lib/SyncContext'
import { AppSettingsProvider } from './context/AppSettingsContext'
import { StorageContextProvider } from './lib/storage/StorageContext'
import { SharedDashboardView } from './components/dashboard/SharedDashboardView'

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()

  const reloadKey = 'boxento-preload-error-last-reload'
  const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0)
  const now = Date.now()

  if (now - lastReload > 10000) {
    window.sessionStorage.setItem(reloadKey, String(now))
    window.location.reload()
  }
})

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Failed to find the root element')

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <StorageContextProvider>
          <SafeSyncProvider>
            <AppSettingsProvider>
              <Routes>
                <Route path="/d/:dashboardId" element={<SharedDashboardView />} />
                <Route path="/*" element={<App />} />
              </Routes>
            </AppSettingsProvider>
          </SafeSyncProvider>
        </StorageContextProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
