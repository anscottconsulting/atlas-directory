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
      // NPPES NPI Registry. It sends no CORS headers, so the browser can't
      // call it directly; Caddy does the same thing in production.
      "/nppes": {
        target: "https://npiregistry.cms.hhs.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/nppes/, ""),
      },
    },
  },
});
