import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Served from https://<user>.github.io/go-wasm-tools/, so assets need the subpath.
export default defineConfig({
  base: '/go-wasm-tools/',
  plugins: [react()],
})
