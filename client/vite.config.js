import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
const apiTarget = process.env.VITE_API_TARGET || "http://localhost:3001";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/api": apiTarget,
    },
  },
})
