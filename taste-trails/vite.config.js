import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_CAPACITOR === 'true' ? './' : '/',
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
