import { expect, test, type Page } from '@playwright/test'
import { installBridge, labels } from './bridge'

const row = (page: Page, label: string) => page.locator(`.commit-row[data-hash="${labels[label]}"]`)

async function loaded(page: Page) {
  await page.goto('/')
  await expect(page.locator('.commit-row').first()).toBeVisible()
}

/** Editors mount a frame at a time once their grammar is in; a host is marked when fully built. */
const ready = (page: Page) => page.locator('.cm-host[data-ready]')

/** Screenshots with the mouse parked on the status bar, so no row wears a hover tint. */
async function shoot(page: Page, name: string) {
  await page.mouse.move(640, 710)
  await expect(page).toHaveScreenshot(name)
}

test('welcome screen', async ({ page }) => {
  await installBridge(page, { initialRepo: false })
  await page.goto('/')
  await expect(page.getByText('Open repository…')).toBeVisible()
  await shoot(page, 'welcome.png')
})

test('history fills the window when nothing is selected', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await shoot(page, 'history.png')
})

test('a selection shows every file as a collapsible section', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(4)
  // the deleted logo is binary and gets a notice; the deleted changelog is full-width red
  await expect(ready(page)).toHaveCount(3)
  await expect(page.locator('.cm-host.single-deleted .cm-editor')).toHaveCount(1)
  await shoot(page, 'overview-unified.png')
})

test('a single file side by side', async ({ page }) => {
  await installBridge(page, { diffMode: 'split' })
  await loaded(page)
  await row(page, "Merge branch 'feature/login'").click()
  await page.locator('#panel-files .tree-row', { hasText: 'main.ts' }).click()
  await expect(ready(page)).toHaveCount(1)
  await expect(page.locator('.cm-mergeView')).toBeVisible()
  await shoot(page, 'single-split.png')
})

test('a file changed twice with a gap stacks its diffs', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore: initial import').click({ modifiers: ['ControlOrMeta'] })
  await page.locator('#panel-files .tree-row', { hasText: 'README.md' }).click()
  await expect(page.locator('#panel-diff .alert-warning')).toBeVisible()
  await expect(ready(page)).toHaveCount(2)
  await shoot(page, 'stacked.png')
})

test('dark theme', async ({ page }) => {
  await installBridge(page, { theme: 'dim' })
  await loaded(page)
  await row(page, 'refactor: app.ts becomes main.ts, logo lands').click()
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(2)
  // the added logo is binary; only main.ts gets an editor
  await expect(ready(page)).toHaveCount(1)
  await shoot(page, 'dark.png')
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
  await shoot(page, 'search.png')
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

test('find in changes opens the matching files and steps through hits', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(4)
  await page.keyboard.press('ControlOrMeta+f')
  await page.locator('#find-input').fill('left-pad')
  await expect(page.locator('#panel-diff')).toContainText('1 match in 1 file')
  // only package.json stays open
  await expect(page.locator('#panel-diff .section-head.open')).toHaveCount(1)
  await expect(ready(page)).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page.locator('.cm-findMatch').first()).toBeVisible()
  await shoot(page, 'find.png')
  await page.keyboard.press('Escape')
  await expect(page.locator('#find-input')).toHaveCount(0)
  await expect(page.locator('#panel-diff .section-head.open')).toHaveCount(4)
})

test('marking a file as reviewed folds it, and a later change turns the mark stale', async ({ page }) => {
  await installBridge(page, { reviewed: { 'src/base.ts': 'some-older-blob' } })
  await loaded(page)
  // the unmerged stack: both of its commits
  await row(page, 'feat(LD-3): top of the stack').click()
  await row(page, 'feat(LD-3): base of the stack').click({ modifiers: ['ControlOrMeta'] })
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(2)
  // base.ts was reviewed at an older version: stale, open, with a "since" toggle
  await expect(page.locator('#panel-diff .section-head.stale')).toHaveCount(1)
  await expect(page.locator('#panel-diff .section-head.stale')).toContainText('base.ts')
  await expect(page.locator('#panel-diff .section-head.stale .btn', { hasText: 'since' })).toBeVisible()
  // mark top.ts: it folds and the counter appears
  await page.locator('#panel-diff .section-head', { hasText: 'top.ts' }).locator('.review').click()
  await expect(page.locator('#panel-diff .section-head.reviewed')).toHaveCount(1)
  await expect(page.locator('#panel-diff .section-head.reviewed')).not.toHaveClass(/open/)
  await expect(page.locator('#panel-diff')).toContainText('1 of 2 reviewed')
  await expect(page.locator('#panel-files .review-reviewed')).toHaveCount(1)
  await expect(ready(page)).toHaveCount(1)
  await shoot(page, 'reviewed.png')
})

test('work already on main has no review marks', async ({ page }) => {
  await installBridge(page, { reviewed: { 'README.md': 'some-older-blob' } })
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await expect(page.locator('#panel-diff .section-head')).toHaveCount(1)
  await expect(page.locator('#panel-diff .review')).toHaveCount(0)
  await expect(page.locator('#panel-diff .section-head.stale')).toHaveCount(0)
})
