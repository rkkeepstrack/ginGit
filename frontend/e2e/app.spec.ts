import { expect, test, type Page } from '@playwright/test'
import { installBridge, labels } from './bridge'

const row = (page: Page, label: string) => page.locator(`.commit-row[data-hash="${labels[label]}"]`)

async function loaded(page: Page) {
  await page.goto('/')
  await expect(page.locator('.commit-row').first()).toBeVisible()
  // Grammars load lazily; wait for syntax colors before shooting code.
  await page.waitForTimeout(200)
}

test('welcome screen', async ({ page }) => {
  await installBridge(page, { initialRepo: false })
  await page.goto('/')
  await expect(page.getByText('Open repository…')).toBeVisible()
  await expect(page).toHaveScreenshot('welcome.png')
})

test('history fills the window when nothing is selected', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await expect(page).toHaveScreenshot('history.png')
})

test('a selection shows every file as a collapsible section', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(4)
  // the deleted logo is binary and gets a notice; the deleted changelog is full-width red
  await expect(page.locator('.cm-editor')).toHaveCount(3)
  await expect(page.locator('.cm-host.single-deleted .cm-editor')).toHaveCount(1)
  await page.waitForTimeout(200)
  await expect(page).toHaveScreenshot('overview-unified.png')
})

test('a single file side by side', async ({ page }) => {
  await installBridge(page, { diffMode: 'split' })
  await loaded(page)
  await row(page, "Merge branch 'feature/login'").click()
  await page.locator('#panel-files .tree-row', { hasText: 'main.ts' }).click()
  await expect(page.locator('.cm-mergeView')).toBeVisible()
  await page.waitForTimeout(200)
  await expect(page).toHaveScreenshot('single-split.png')
})

test('a file changed twice with a gap stacks its diffs', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore: initial import').click({ modifiers: ['ControlOrMeta'] })
  await page.locator('#panel-files .tree-row', { hasText: 'README.md' }).click()
  await expect(page.locator('#panel-diff .alert-warning')).toBeVisible()
  await expect(page.locator('.cm-editor')).toHaveCount(2)
  await page.waitForTimeout(200)
  await expect(page).toHaveScreenshot('stacked.png')
})

test('dark theme', async ({ page }) => {
  await installBridge(page, { theme: 'dim' })
  await loaded(page)
  await row(page, 'refactor: app.ts becomes main.ts, logo lands').click()
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(2)
  await page.waitForTimeout(200)
  await expect(page).toHaveScreenshot('dark.png')
})

test('clicking a branch pill selects its own commits', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('.ref-pill', { hasText: 'feature/stack-top' }).click()
  await expect(page.locator('.commit-row.selected')).toHaveCount(1)
  await expect(page.locator('#panel-files')).toContainText('1 commit')
})

test('search narrows the list', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('#commit-search').fill('login')
  await expect(page.locator('.commit-row')).toHaveCount(3)
  // no lanes while filtering; a branch badge says where each hit lives
  await expect(page.locator('.commit-row > svg')).toHaveCount(0)
  await expect(page.locator('.ref-pill.branch').first()).toBeVisible()
  await expect(page).toHaveScreenshot('search.png')
})

test('a branch badge in search results reviews the branch and jumps to it', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('#commit-search').fill('password')
  await expect(page.locator('.commit-row')).toHaveCount(1)
  await page.locator('.commit-row .ref-pill.branch', { hasText: 'feature/login' }).click()
  await expect(page.locator('#commit-search')).toHaveValue('')
  await expect(page.locator('.commit-row.selected')).toHaveCount(2)
  await expect(page.locator('#panel-files')).toContainText('2 commits')
  await expect(page.locator('.commit-row > svg').first()).toBeVisible()
})
