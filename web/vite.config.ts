/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The colorize worker imports onnxruntime-web, which needs ES module workers.
  worker: { format: 'es' },
  // onnxruntime-web ships prebuilt bundles; pre-bundling them breaks its WASM loading.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
