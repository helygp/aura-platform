import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }

export default defineConfig({
  plugins: [react()],

  define: {
    __APP_VERSION__:    JSON.stringify(pkg.version),
    __APP_BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },

  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3001', changeOrigin: true },
      '/api':  { target: 'http://localhost:3001', changeOrigin: true },
    },
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react':   ['react', 'react-dom', 'react-router-dom'],
          'vendor-charts':  ['recharts'],
          'vendor-motion':  ['framer-motion'],
          'vendor-icons':   ['lucide-react'],
        },
      },
    },
  },
})
