import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

import NetworkGate from './components/system/NetworkGate.jsx';
import { installAdminSessionLifecycle } from './services/authService.js';
import {
  getPortalNameFromPath,
  hydratePortalSessionFromPeerTabs,
  hydrateRememberedSessions,
  installPortalSessionSync,
  installSessionInvalidationFetchGuard,
} from './utils/authStorage.js';

async function bootstrap() {
  hydrateRememberedSessions();

  const pathname = window.location.pathname || '';
  const portalName = getPortalNameFromPath(pathname);

  // Protected routes and the unified login page may resume an already active
  // same-browser session before React mounts. Unrelated public pages render
  // immediately and are never blocked by a stale active-portal hint.
  if (portalName || pathname === '/login') {
    await hydratePortalSessionFromPeerTabs({ portalName });
  }

  installPortalSessionSync();
  installSessionInvalidationFetchGuard();
  installAdminSessionLifecycle();

  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <NetworkGate>
        <App />
      </NetworkGate>
    </StrictMode>
  );
}

bootstrap();
