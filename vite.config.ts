import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist"
  },
  preview: {
    host: "0.0.0.0",
    port: parseInt(process.env.PORT) || 4173,
  },
});
