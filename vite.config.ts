import { fileURLToPath, URL } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react"; // Import React plugin

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), // Use React plugin instead of Vue and Vuetify
    // Removed vuetify()
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
  optimizeDeps: {
    // Remove Vue-specific exclusions and entries.
    // Vite will handle React dependencies automatically.
  },
});
