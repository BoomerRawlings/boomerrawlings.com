// Optional regeneration: install Playwright in your development environment.
// The normal site build uses the checked-in PNG and needs no browser.
import { fileURLToPath } from 'node:url';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(new URL('./roomie-preview.html', import.meta.url).href);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: fileURLToPath(new URL('../public/0311/social-preview-v1.png', import.meta.url)) });
} finally {
  await browser.close();
}
