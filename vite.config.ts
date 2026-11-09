import { defineConfig } from "vite";

// Auf GitHub Pages liegt die App unter /<repo-name>/. Der Workflow setzt BASE_PATH passend.
export default defineConfig({
  base: process.env.BASE_PATH ?? "/",
  build: { target: "es2020", chunkSizeWarningLimit: 900 },
});
