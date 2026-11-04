import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// `make site-shots`: the suite's setup, site.spec.ts instead of the tests.
export default defineConfig({ ...base, testIgnore: [], testMatch: 'site.spec.ts' })
