import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy /api requests to Supabase (using anon key via server-side)
      // Note: Supabase JS client is called directly from browser
      // This proxy is for any future edge functions or custom API
    },
  },
})
