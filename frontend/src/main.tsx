import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

const boot = document.getElementById('boot-splash');
if (boot) {
  boot.classList.add('boot-leave');
  window.setTimeout(() => boot.remove(), 600);
}
