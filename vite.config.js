import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages serves the site from /quant-strat-backtester/, so production
// builds need that base path. Local dev stays at the root.
export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'build' ? '/quant-strat-backtester/' : '/',
}));
