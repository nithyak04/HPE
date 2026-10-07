import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the same build works at a domain root (Vercel)
  // and under a sub-path (GitHub Pages serves it at /HPE/).
  base: './',
})
