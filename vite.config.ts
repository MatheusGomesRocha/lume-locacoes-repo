/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// VITE_BASE: pasta do site no GitHub Pages (ex.: /lume-locacoes/). Local e produção própria usam "/".
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 700, rollupOptions: { output: { manualChunks: { graficos: ['recharts'] } } } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
