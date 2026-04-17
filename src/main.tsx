import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import App from './App';
import './index.css';

// Version banner — visible in DevTools console + globally on window.__TARMEER__
const VERSION_INFO = { version: __APP_VERSION__, commit: __APP_COMMIT__, buildTime: __APP_BUILD_TIME__ };
(window as any).__TARMEER__ = VERSION_INFO;
// eslint-disable-next-line no-console
console.log(
  `%cTarmeer v${__APP_VERSION__} %c(${__APP_COMMIT__}, built ${__APP_BUILD_TIME__})`,
  'color:#b8864a;font-weight:bold',
  'color:#a8a29e'
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <App />
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>
);
