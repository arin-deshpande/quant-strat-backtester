import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /quant-strat-backtester/, so production
// builds (and `npm run preview`, which serves that build) need that base path.
// Local dev stays at the root.
export default defineConfig(({ command, isPreview }) => ({
  plugins: [react()],
  base: command === 'serve' && !isPreview ? '/' : '/quant-strat-backtester/',
}));
