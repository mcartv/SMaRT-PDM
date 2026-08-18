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

  await hydratePortalSessionFromPeerTabs({
    portalName: getPortalNameFromPath(window.location.pathname),
  });

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
