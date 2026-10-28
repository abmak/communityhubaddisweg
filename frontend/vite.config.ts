import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on 4000 in development. Proxying keeps cookies same-origin and
// avoids CORS entirely for local development.
export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 loopback explicitly. With the default "localhost" Vite can end
    // up on ::1 only, which makes http://127.0.0.1:5173 unreachable on Windows.
    host: "127.0.0.1",
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
