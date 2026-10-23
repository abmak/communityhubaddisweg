import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on 4000 in development. Proxying keeps cookies same-origin and
// avoids CORS entirely for local development.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/uploads": { target: "http://localhost:4000", changeOrigin: true },
      "/socket.io": { target: "http://localhost:4000", ws: true },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: {
        // Keep the framework and realtime client in their own long-lived chunks.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          realtime: ["socket.io-client"],
        },
      },
    },
  },
});
