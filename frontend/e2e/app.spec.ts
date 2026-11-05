import { expect, test, type Page } from '@playwright/test'
import { installBridge, labels } from './bridge'

const row = (page: Page, label: string) => page.locator(`.log-row[data-hash="${labels[label]}"]`)

async function loaded(page: Page) {
  await page.goto('/')
  await expect(page.locator('.log-row').first()).toBeVisible()
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

test('a selection shows every file as a collapsible entry', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
  await expect(page.locator('#review .entry-head')).toHaveCount(4)
  // the deleted logo is binary and gets a notice; the deleted changelog is full-width red
  await expect(ready(page)).toHaveCount(3)
  await expect(page.locator('.cm-host.single-deleted .cm-editor')).toHaveCount(1)
  await shoot(page, 'overview-unified.png')
})

test('side by side, and the tree click scrolls to the file', async ({ page }) => {
  await installBridge(page, { diffMode: 'split' })
  await loaded(page)
  await row(page, "Merge branch 'feature/login'").click()
  await expect(page.locator('#review .entry-head')).toHaveCount(2)
  await page.locator('#files .tree-row', { hasText: 'main.ts' }).click()
  await expect(page.locator('#files .tree-row.active')).toContainText('main.ts')
  await expect(page.locator('.entry.current .entry-head')).toContainText('main.ts')
  await expect(ready(page)).toHaveCount(2)
  await expect(page.locator('.cm-mergeView').first()).toBeVisible()
  await shoot(page, 'single-split.png')
})

test('collapse all also folds the file picked in the tree', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, "Merge branch 'feature/login'").click()
  await page.locator('#files .tree-row', { hasText: 'main.ts' }).click()
  await expect(page.locator('#review .entry-head.open')).toHaveCount(2)
  await page.locator('#review .panel-head button').click()
  await expect(page.locator('#review .entry-head.open')).toHaveCount(0)
})

test('the file filter is one shortcut away and clears with its x', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, "Merge branch 'feature/login'").click()
  const filter = page.getByPlaceholder('Filter files')
  await page.keyboard.press('ControlOrMeta+E')
  await expect(filter).toBeFocused()
  await page.keyboard.type('login')
  await expect(page.locator('#files .tree-row', { hasText: 'main.ts' })).toHaveCount(0)
  await page.locator('#files label.input button').click()
  await expect(filter).toHaveValue('')
  await expect(page.locator('#files .tree-row', { hasText: 'main.ts' })).toHaveCount(1)
})

test('a file changed twice with a gap stacks its diffs', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore: initial import').click({ modifiers: ['ControlOrMeta'] })
  await expect(page.locator('#review .alert-warning')).toBeVisible()
  // README stacks two pairs; app.ts and package.json are plain additions
  await expect(ready(page)).toHaveCount(4)
  await shoot(page, 'stacked.png')
})

test('dark theme', async ({ page }) => {
  await installBridge(page, { theme: 'dim' })
  await loaded(page)
  await row(page, 'refactor: app.ts becomes main.ts, logo lands').click()
  await expect(page.locator('#review .entry-head')).toHaveCount(2)
  // the added logo is binary; only main.ts gets an editor
  await expect(ready(page)).toHaveCount(1)
  await shoot(page, 'dark.png')
})

test('clicking a branch pill selects its own commits', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('.ref-pill', { hasText: 'feature/stack-top' }).click()
  await expect(page.locator('.log-row.selected')).toHaveCount(1)
  await expect(page.locator('#files')).toContainText('1 commit')
})

test('search narrows the list', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('#commit-search').fill('login')
  await expect(page.locator('.log-row')).toHaveCount(3)
  // no lanes while filtering; a branch badge says where each hit lives
  await expect(page.locator('.log-row > svg')).toHaveCount(0)
  await expect(page.locator('.ref-pill.branch').first()).toBeVisible()
  await shoot(page, 'search.png')
})

test('a branch badge in search results reviews the branch and jumps to it', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await page.locator('#commit-search').fill('password')
  await expect(page.locator('.log-row')).toHaveCount(1)
  await page.locator('.log-row .ref-pill.branch', { hasText: 'feature/login' }).click()
  await expect(page.locator('#commit-search')).toHaveValue('')
  await expect(page.locator('.log-row.selected')).toHaveCount(2)
  await expect(page.locator('#files')).toContainText('2 commits')
  await expect(page.locator('.log-row > svg').first()).toBeVisible()
})

test('find in changes opens the matching files and steps through hits', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
  await expect(page.locator('#review .entry-head')).toHaveCount(4)
  await page.keyboard.press('ControlOrMeta+f')
  await page.locator('#find-input').fill('left-pad')
  await expect(page.locator('#review')).toContainText('1 match in 1 file')
  // only package.json stays open
  await expect(page.locator('#review .entry-head.open')).toHaveCount(1)
  await expect(ready(page)).toHaveCount(1)
  await page.keyboard.press('Enter')
  await expect(page.locator('.cm-findMatch').first()).toBeVisible()
  await shoot(page, 'find.png')
  await page.keyboard.press('Escape')
  await expect(page.locator('#find-input')).toHaveCount(0)
  await expect(page.locator('#review .entry-head.open')).toHaveCount(4)
})

test('stepping to a hit inside unchanged lines unfolds them', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  // the rename leaves main.ts unchanged: its four lines arrive folded
  await row(page, 'refactor: app.ts becomes main.ts, logo lands').click()
  await expect(page.locator('#review .cm-collapsedLines')).toHaveCount(1)
  await page.keyboard.press('ControlOrMeta+f')
  await page.locator('#find-input').fill('hello')
  await expect(page.locator('#review')).toContainText('1 match in 1 file')
  await page.keyboard.press('Enter')
  await expect(page.locator('#review .cm-collapsedLines')).toHaveCount(0)
  await expect(page.locator('.cm-findMatch')).toBeVisible()
})

test('a changed image shows before and after side by side', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click()
  await expect(page.locator('.image-pair.both .image-side')).toHaveCount(2)
  await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.image-side img')].every((i) => i.complete && i.naturalWidth > 0))
  await expect(page.locator('.image-side figcaption')).toHaveText(['Before · 96 × 96 · 578 B', 'After · 128 × 96 · 662 B'])
  await expect(ready(page)).toHaveCount(1)
  await shoot(page, 'image.png')
})

test('editor diff style: new lines green, changed lines blue; patch is one menu away', async ({ page }) => {
  await installBridge(page)
  await loaded(page)
  // README only gains lines here
  await row(page, 'docs: usage section').click()
  await expect(page.locator('.cm-editor .cm-kind-inserted.cm-changedLine').first()).toHaveCSS('background-color', 'rgb(227, 247, 236)')
  // package.json changes its version line and grows a block below it
  await row(page, 'chore(LD-2): depend on left-pad, as one does').click()
  const changed = page.locator('.cm-editor .cm-kind-modified.cm-changedLine').first()
  await expect(changed).toHaveCSS('background-color', 'rgb(229, 242, 253)')
  await page.locator('.dropdown-end [role="button"]').click()
  await page.getByRole('button', { name: 'Patch' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-diff', 'patch')
  await expect(changed).toHaveCSS('background-color', 'rgb(211, 249, 216)')
})

test('marking a file as reviewed folds it, and a later change turns the mark stale', async ({ page }) => {
  await installBridge(page, { reviewed: { 'src/base.ts': 'some-older-blob' } })
  await loaded(page)
  // the unmerged stack: both of its commits
  await row(page, 'feat(LD-3): top of the stack').click()
  await row(page, 'feat(LD-3): base of the stack').click({ modifiers: ['ControlOrMeta'] })
  await expect(page.locator('#review .entry-head')).toHaveCount(2)
  // base.ts was reviewed at an older version: stale, open, with an All / New toggle
  await expect(page.locator('#review .entry-head.stale')).toHaveCount(1)
  await expect(page.locator('#review .entry-head.stale')).toContainText('base.ts')
  await expect(page.locator('#review .entry-head.stale .tab', { hasText: 'New' })).toBeVisible()
  // mark top.ts: it folds and the counter appears
  await page.locator('#review .entry-head', { hasText: 'top.ts' }).locator('.review').click()
  await expect(page.locator('#review .entry-head.reviewed')).toHaveCount(1)
  await expect(page.locator('#review .entry-head.reviewed')).not.toHaveClass(/open/)
  await expect(page.locator('#review')).toContainText('1 of 2 reviewed')
  await expect(page.locator('#files .review-reviewed')).toHaveCount(1)
  await expect(ready(page)).toHaveCount(1)
  await shoot(page, 'reviewed.png')
})

test('work already on main has no review marks', async ({ page }) => {
  await installBridge(page, { reviewed: { 'README.md': 'some-older-blob' } })
  await loaded(page)
  await row(page, 'docs: more usage').click()
  await expect(page.locator('#review .entry-head')).toHaveCount(1)
  await expect(page.locator('#review .review')).toHaveCount(0)
  await expect(page.locator('#review .entry-head.stale')).toHaveCount(0)
})
