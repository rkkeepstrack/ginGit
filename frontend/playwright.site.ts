import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// `make site-shots`: the suite's setup, site.spec.ts instead of the tests.
// The window is exactly as wide as the site's text column, so the images are
// displayed 1:1 and never resampled; once per pixel density. Set on the
// projects: their device preset would override top-level values.
const viewport = { width: 992, height: 620 }
const chrome = base.projects![0]

export default defineConfig({
  ...base,
  testIgnore: [],
  testMatch: 'site.spec.ts',
  projects: [
    { ...chrome, name: '1x', use: { ...chrome.use, viewport, deviceScaleFactor: 1 } },
    { ...chrome, name: '2x', use: { ...chrome.use, viewport, deviceScaleFactor: 2 } },
  ],
})
