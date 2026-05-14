import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Professional handling of benign WebSocket errors in development environments behind proxies
if (process.env.NODE_ENV === 'development') {
  const isBenign = (m: string) => 
    m.includes('WebSocket') || 
    m.includes('HMR') || 
    m.includes('vite') || 
    m.toLowerCase().includes('websocket closed') ||
    m.toLowerCase().includes('connection to websocket');

  window.addEventListener('unhandledrejection', (event) => {
    const msg = event.reason?.message || String(event.reason || '');
    if (isBenign(msg)) {
      event.preventDefault();
      // Completely silent for professional environment
    }
  });

  window.addEventListener('error', (event) => {
    const msg = event.error?.message || event.message || '';
    if (isBenign(msg)) {
      event.preventDefault();
    }
  });

  // Also silence console.error for these specific messages
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (args[0] && typeof args[0] === 'string' && isBenign(args[0])) return;
    originalError(...args);
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
