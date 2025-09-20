/* Headless probe to verify leaderboard renders and 3D canvas mounts.
 * Usage: node scripts/headless_check.js
 */
const http = require('http');

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, res => {
        if (res.statusCode && res.statusCode < 500) {
          res.resume(); resolve(true); return;
        }
        res.resume();
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, 800);
      });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error('timeout'));
        setTimeout(tick, 800);
      });
    };
    tick();
  });
}

(async () => {
  const puppeteer = require('puppeteer');
  const base = 'http://localhost:3000/lab/scroll3d?dbg=1';
  await waitForServer('http://localhost:3000');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-gpu', '--enable-webgl', '--ignore-gpu-blacklist',
      '--use-gl=angle', '--use-angle=swiftshader'
    ]
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);
  page.on('console', msg => console.log('[console]', msg.type(), msg.text()));
  page.on('pageerror', err => console.error('[pageerror]', err.message));
  await page.goto(base, { waitUntil: 'load' });
  // Wait for Canvas from @react-three/fiber to mount
  await page.waitForSelector('canvas', { timeout: 30000 });
  // Give React some time to mount Scene
  await new Promise(r => setTimeout(r, 1200));
  const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
  const hasLoading = await page.evaluate(() => !!Array.from(document.querySelectorAll('body *')).find(n => n.textContent && n.textContent.toLowerCase().includes('loading')));
  await page.screenshot({ path: 'dev.leaderboard_check.png', fullPage: false });
  console.log(JSON.stringify({ ok: true, hasCanvas, hasLoading }));
  await browser.close();
})().catch(err => { console.error('[headless_check] error:', err.message); process.exit(1); });

