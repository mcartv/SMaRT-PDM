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

const PEER_SESSION_ENTRY_PATHS = new Set(['/', '/landing', '/login']);

async function bootstrap() {
  hydrateRememberedSessions();

  const pathname = window.location.pathname || '';
  const portalName = getPortalNameFromPath(pathname);

  // A newly opened browser tab does not inherit sessionStorage from an
  // existing tab. Protected routes and the main entry pages therefore ask an
  // already-authenticated peer tab for the shared browser session before React
  // mounts. Existing public tabs are still not redirected when another tab
  // signs in later; authStorage handles SESSION_ESTABLISHED without hijacking
  // unrelated public navigation.
  if (portalName || PEER_SESSION_ENTRY_PATHS.has(pathname)) {
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
