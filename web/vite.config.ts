/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Open Graph / Twitter images must be absolute URLs. On Vercel,
// VERCEL_PROJECT_PRODUCTION_URL is the bare production domain (no scheme);
// elsewhere the placeholder becomes '' and the path stays relative.
function siteUrl(): Plugin {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const origin = host ? `https://${host}` : ''
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', origin),
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl()],
  // The colorize worker imports onnxruntime-web, which needs ES module workers.
  worker: { format: 'es' },
  // onnxruntime-web ships prebuilt bundles; pre-bundling them breaks its WASM loading.
  optimizeDeps: { exclude: ['onnxruntime-web'] },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
