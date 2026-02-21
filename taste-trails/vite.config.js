import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  root: '.',
  server: {
    port: 5174,
  },
  build: {
    rollupOptions: {
      input: 'index.html',
    },
  },
})
