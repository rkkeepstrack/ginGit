/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// Under wails dev every request reaches Vite first, and Vite answers unknown
// paths with index.html. Repository images come from the Go handler, which
// Wails only asks after a 404.
const blobsFromGo: Plugin = {
  name: 'blobs-from-go',
  configureServer(server) {
    server.middlewares.use('/blob/', (_req, res) => {
      res.statusCode = 404
      res.end()
    })
  },
}

export default defineConfig({
  plugins: [svelte(), tailwindcss(), blobsFromGo],
  // Pre-bundle everything the app imports, so the dev server never discovers a
  // dependency mid-session and reloads the window under the Wails proxy.
  optimizeDeps: {
    include: ['@lucide/svelte/icons/*', '@codemirror/view', '@codemirror/state', '@codemirror/merge', '@codemirror/language', '@codemirror/language-data', '@lezer/highlight'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
