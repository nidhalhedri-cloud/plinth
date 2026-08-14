import 'server-only';
import type { Browser } from 'puppeteer';

// One shared headless browser for the process (launching per-request is slow). Lazily started and
// re-launched if it ever disconnects.
let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const puppeteer = (await import('puppeteer')).default;
    browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  }
  const b = await browserPromise;
  if (!b.connected) { browserPromise = null; return getBrowser(); }
  return b;
}

export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Images are inline data URIs, so 'load' is enough — there are no network requests to idle on.
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '0', bottom: '0', left: '0', right: '0' } });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
