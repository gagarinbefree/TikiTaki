import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEMO_TEXT } from '../config';
import { showRepositoryLink } from '../version';
import App from './App';
import '../vendor/bootstrap-6.0.0-alpha.1/bootstrap.css';

showRepositoryLink();
const root = document.getElementById(DEMO_TEXT.app);
if (root === null) throw new Error(DEMO_TEXT.missingDemoRoot);
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
