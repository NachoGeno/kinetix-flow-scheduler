import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from "path";
import { componentTagger } from 'lovable-tagger'

export default defineConfig({
  plugins: [
    react(),
    process.env.NODE_ENV === 'development' && componentTagger()
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: process.env.NODE_ENV === 'development' ? 8080 : parseInt(process.env.PORT || '4173'),
  },
  preview: {
    host: '0.0.0.0',
    port: parseInt(process.env.PORT || '4173'),
    allowedHosts: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
