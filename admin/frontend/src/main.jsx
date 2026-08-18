import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App.jsx';
import './index.css';

import NetworkGate from './components/system/NetworkGate.jsx';
import { installAdminSessionLifecycle } from './services/authService.js';
import {
  hydrateRememberedSessions,
  installSessionInvalidationFetchGuard,
} from './utils/authStorage.js';

hydrateRememberedSessions();
installSessionInvalidationFetchGuard();
installAdminSessionLifecycle();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <NetworkGate>
      <App />
    </NetworkGate>
  </StrictMode>
);
