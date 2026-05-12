import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Professional handling of benign WebSocket errors in development environments behind proxies
if (process.env.NODE_ENV === 'development') {
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('WebSocket') || event.reason?.message?.includes('HMR')) {
      event.preventDefault();
      console.debug('Caught and silenced benign WebSocket/HMR rejection:', event.reason.message);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
