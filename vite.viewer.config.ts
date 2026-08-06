import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/policy/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  define: {
    "import.meta.env.VITE_APP_MODE": JSON.stringify("viewer"),
    "import.meta.env.VITE_API_URL": JSON.stringify("/policy/api"),
  },
  build: {
    outDir: "dist-viewer",
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, "index.viewer.html"),
    },
  },
});
