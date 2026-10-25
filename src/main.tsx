import { StrictMode } from 'react';
import { MotionConfig } from 'motion/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './theme/tokens.css';
import './theme/base.css';
import './theme/components.css';
import './theme/shell.css';
import './theme/pages.css';
import './theme/auth.css';
import { ImsProvider } from './services';
import { App } from './app/App';
import { ThemeSync } from './components/ThemeSync';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <ImsProvider>
        <BrowserRouter>
          <ThemeSync />
          <App />
        </BrowserRouter>
      </ImsProvider>
    </MotionConfig>
  </StrictMode>,
);
