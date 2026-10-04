import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const clientRoot = path.resolve(import.meta.dirname);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, clientRoot, "");
  const port = Number(env.PORT || 4178);
  const apiOrigin = (env.VITE_API_URL || "http://127.0.0.1:4179").replace(/\/$/, "");

  return {
    envDir: clientRoot,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(clientRoot, "./src"),
      },
    },
    server: {
      host: "0.0.0.0",
      port,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
