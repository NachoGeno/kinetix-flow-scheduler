import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";

const port = parseInt(process.env.PORT || '4173')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: port,
  },
  preview: {
    host: '0.0.0.0',
    port: port,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@rollup/rollup-linux-x64-gnu']
  },
  define: {
    global: 'globalThis',
  }
})
