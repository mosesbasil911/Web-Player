import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { GlobalMuteProvider } from '@media-plyr/components/context/GlobalMuteContext.tsx';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalMuteProvider>
      <App />
    </GlobalMuteProvider>
  </StrictMode>,
);
