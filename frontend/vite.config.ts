/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
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
