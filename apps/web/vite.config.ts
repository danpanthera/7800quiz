import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 15173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:13010',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'ws://localhost:13010',
        ws: true,
      },
    },
  },
})
