import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import history from "connect-history-api-fallback";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Fallback para SPA (Single Page Applications)
    {
      name: 'html-fallback',
      configureServer(server) {
        server.middlewares.use(history());
      }
    }
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 8080,
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          "react-router": ["react-router-dom"],
          "ui-radix": [
            "@radix-ui/react-select",
            "@radix-ui/react-dialog",
            "@radix-ui/react-tabs",
            "@radix-ui/react-popover",
          ],
          "ui-forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          supabase: ["@supabase/supabase-js"],
          "react-query": ["@tanstack/react-query"],
          "date-utils": ["date-fns", "react-day-picker"],
          charts: ["recharts"],
          pdf: ["jspdf", "pdf-lib"],
        },
      },
    },
  },
}));
