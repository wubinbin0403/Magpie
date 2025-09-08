import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const isDev = mode === 'development'
  
  return {
    plugins: [],
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src')
      }
    },
    
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: isDev,
      minify: !isDev,
      rollupOptions: {
        input: {
          background: 'src/background/background.ts',
          popup: 'src/popup/popup.html',
          options: 'src/options/options.html',
        },
        output: {
          entryFileNames: '[name].js',
          chunkFileNames: 'chunks/[name]-[hash].js',
          assetFileNames: '[name][extname]'
        }
      }
    },
    
    // Copy static assets
    publicDir: 'public',
    
    // Development server settings
    server: {
      port: 5174,
      strictPort: true,
      hmr: {
        port: 5174
      }
    }
  }
})