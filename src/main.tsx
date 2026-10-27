import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

if ('serviceWorker' in navigator) {
  let reloadingForUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
