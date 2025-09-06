import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    hmr: {
      host: 'localhost',
      port: 3000,
    },
    proxy: {
      // Proxy API requests to the backend during development
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching and loading
        manualChunks: {
          // Vendor chunk for React and related libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Heroicons separate chunk (large icon library)
          'icons-vendor': ['@heroicons/react/24/outline'],
          // Small UI utilities
          'ui-vendor': ['clsx'],
          // Data fetching and state management
          'query-vendor': ['@tanstack/react-query'],
          // DnD kit (used mainly in admin)
          'dnd-vendor': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
        },
        // Ensure chunks have consistent names for better caching
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
      },
    },
    // Increase chunk size warning limit to 600kB (reasonable for modern apps)
    chunkSizeWarningLimit: 600,
  },
  preview: {
    port: 3000,
    host: true,
  },
})