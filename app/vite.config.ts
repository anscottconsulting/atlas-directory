import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The browser app talks to /fhir/* and Vite proxies to the local HAPI container
// running on http://localhost:8081. This sidesteps CORS for local dev.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/fhir": {
        target: "http://localhost:8081",
        changeOrigin: true,
      },
    },
  },
});
