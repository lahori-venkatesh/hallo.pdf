// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';

// Register Service Worker
const registerServiceWorker = () => {
  // Skip registration in development mode to avoid Vite dev server issues
  if (process.env.NODE_ENV !== 'production') {
    console.log('Service Worker registration skipped in development mode.');
    return;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' }) // Correct service worker path
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  } else {
    console.log('Service Workers are not supported in this browser.');
  }
};

// Render the app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>
);

// Register service worker after app mounts
registerServiceWorker();