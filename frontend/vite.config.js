import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // ws: true lets the realtime WebSocket (/api/ws) pass through the dev proxy
      '/api': { target: 'http://localhost:8001', ws: true, changeOrigin: true },
      '/uploads': 'http://localhost:8001',
    },
  },
})