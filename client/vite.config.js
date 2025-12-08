import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: {
      '/api': 'http://localhost:5177',
      '/socket.io': {
        target: 'http://localhost:5177',
        ws: true
      }
    }
  }
})
