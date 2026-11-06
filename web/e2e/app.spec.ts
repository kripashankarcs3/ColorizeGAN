import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SAMPLE = fileURLToPath(new URL('../public/samples/building_GL.jpg', import.meta.url))

/** Mean |R-G| + |G-B| of the image behind an <img>; ~0 for a grey picture. */
async function colourfulness(page: Page, alt: string): Promise<number> {
  return page
    .getByRole('img', { name: alt })
    .first()
    .evaluate(async (el) => {
      const img = el as HTMLImageElement
      await img.decode()
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, c.width, c.height).data
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += Math.abs(d[i] - d[i + 1]) + Math.abs(d[i + 1] - d[i + 2])
      return sum / (d.length / 4)
    })
}

test('upload, colorize and download a full-size PNG', async ({ page }) => {
  await page.goto('/#/colorize')
  await page.locator('input[type=file]').setInputFiles(SAMPLE)
  await expect(page.getByText(/150 [x×] 150 px/).first()).toBeVisible()

  await page.getByRole('button', { name: /Colorize image/ }).click()
  const download = page.getByRole('link', { name: /Download PNG/ })
  await expect(download).toBeVisible()

  expect(await colourfulness(page, 'Colorized version of building_GL.jpg')).toBeGreaterThan(4)

  const [file] = await Promise.all([page.waitForEvent('download'), download.click()])
  expect(file.suggestedFilename()).toBe('building_GL_colorized.png')
  const bytes = readFileSync((await file.path())!)
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG')
  expect(bytes.readUInt32BE(16)).toBe(150) // IHDR width
  expect(bytes.readUInt32BE(20)).toBe(150) // IHDR height
})

test('rejects unsupported file types', async ({ page }) => {
  await page.goto('/#/colorize')
  await page.locator('input[type=file]').setInputFiles({
    name: 'anim.gif',
    mimeType: 'image/gif',
    buffer: Buffer.from('GIF89a'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'Unsupported file type' })).toBeVisible()
})

test('gallery colorizes a sample', async ({ page }) => {
  await page.goto('/#/gallery')
  const card = page.getByRole('article').first()
  await card.getByRole('button', { name: 'Colorize sample' }).click()
  await expect(card.getByRole('link', { name: 'Download PNG' })).toBeVisible()
  await expect(card.getByRole('button', { name: 'Run again' })).toBeVisible()
})
