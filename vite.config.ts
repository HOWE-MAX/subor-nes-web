import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    host: '127.0.0.1',
    open: false,
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1200,
  },
})
