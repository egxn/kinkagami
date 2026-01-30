import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    global: "window",
  },
  server: {
    proxy: {
      "/api/videos": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/videos": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
