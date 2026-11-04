import { expect, test, type Page } from '@playwright/test'
import { installBridge, labels } from './bridge'

// Screenshots for the site, light and dark, at 1x and 2x, written to
// e2e/site-shots and encoded into site/img by `make site-shots`. Not compared to anything.
const row = (page: Page, label: string) => page.locator(`.log-row[data-hash="${labels[label]}"]`)
const ready = (page: Page) => page.locator('.cm-host[data-ready]')

async function loaded(page: Page) {
  await page.goto('/')
  await expect(page.locator('.log-row').first()).toBeVisible()
}

// The mouse rests on the status bar, so nothing wears a hover tint.
async function shoot(page: Page, name: string) {
  await page.mouse.move(600, page.viewportSize()!.height - 10)
  const density = test.info().project.name === '2x' ? '@2x' : ''
  await page.screenshot({ path: `e2e/site-shots/${name}${density}.png` })
}

for (const [suffix, theme] of [['light', 'pastel'], ['dark', 'dim']] as const) {
  test(`review ${suffix}`, async ({ page }) => {
    await installBridge(page, { theme })
    await loaded(page)
    await row(page, 'docs: more usage').click()
    await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
    await expect(page.locator('#review .entry-head')).toHaveCount(4)
    await expect(ready(page)).toHaveCount(3)
    await shoot(page, `review-${suffix}`)
  })

  test(`marks ${suffix}`, async ({ page }) => {
    await installBridge(page, { theme, reviewed: { 'src/base.ts': 'some-older-blob' } })
    await loaded(page)
    await row(page, 'feat(LD-3): top of the stack').click()
    await row(page, 'feat(LD-3): base of the stack').click({ modifiers: ['ControlOrMeta'] })
    await expect(page.locator('#review .entry-head.stale')).toHaveCount(1)
    await page.locator('#review .entry-head', { hasText: 'top.ts' }).locator('.review').click()
    await expect(page.locator('#review')).toContainText('1 of 2 reviewed')
    await expect(ready(page)).toHaveCount(1)
    await shoot(page, `marks-${suffix}`)
  })

  test(`find ${suffix}`, async ({ page }) => {
    await installBridge(page, { theme })
    await loaded(page)
    await row(page, 'docs: more usage').click()
    await row(page, 'chore(LD-2): depend on left-pad, as one does').click({ modifiers: ['Shift'] })
    await expect(page.locator('#review .entry-head')).toHaveCount(4)
    await page.keyboard.press('ControlOrMeta+f')
    await page.locator('#find-input').fill('left')
    await expect(page.locator('#review')).toContainText('1 match in 1 file')
    await expect(ready(page)).toHaveCount(1)
    await page.keyboard.press('Enter')
    await expect(page.locator('.cm-findMatch').first()).toBeVisible()
    await shoot(page, `find-${suffix}`)
  })
}
