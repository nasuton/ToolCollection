import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';

const DIST = process.argv[2];
const BASE = '/go-wasm-tools/';
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
};

// Mimics GitHub Pages: content served under a subpath.
const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(BASE)) {
    console.log('SERVER 404 (outside base):', p);
    res.writeHead(404).end('outside base');
    return;
  }
  p = p.slice(BASE.length) || 'index.html';
  const file = join(DIST, p);
  if (!existsSync(file)) {
    console.log('SERVER 404 (missing):', file);
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}${BASE}`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();

const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => console.log('REQFAIL', r.url()));
page.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });

let failures = 0;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failures++;
};

await page.goto(url, { waitUntil: 'networkidle' });

// Scope by panel: a hidden panel is removed from the accessibility tree,
// so its controls are intentionally unreachable.
const pwPanel = page.locator('#panel-password');
const qrPanel = page.locator('#panel-qr');
const genPw = () => pwPanel.getByRole('button', { name: '生成する' }).click();
const genQr = () => qrPanel.getByRole('button', { name: '生成する' }).click();
const pwValue = () => pwPanel.locator('output.result').innerText();

// 1. WASM finished loading and the banner disappeared
await page.waitForSelector('.banner.loading', { state: 'detached', timeout: 20000 });
check('wasm loaded (banner gone)', true);

// 2. A password was auto-generated on load
const pw = await pwValue();
check('password auto-generated', pw.length === 20, `-> ${pw}`);

// 3. Regenerate produces a different value
await genPw();
const pw2 = await pwValue();
check('regenerate differs', pw2 !== pw, `-> ${pw2}`);

// 4. Slider change is reflected
await page.locator('#pw-length').fill('32');
await genPw();
const pw3 = await pwValue();
check('length 32 honoured', pw3.length === 32);

// 5. Turning options off restricts the charset
for (const name of ['大文字 (A-Z)', '数字 (2-9)', '記号 (!@#$...)']) {
  await page.getByRole('checkbox', { name }).uncheck();
}
await genPw();
const pw4 = await pwValue();
check('lowercase-only option', /^[a-z]{32}$/.test(pw4), `-> ${pw4}`);

// 6. Keyboard-only tab switching (arrow keys, per WAI-ARIA)
await page.getByRole('tab', { name: 'パスワード生成' }).focus();
await page.keyboard.press('ArrowRight');
const qrTabSelected = await page.getByRole('tab', { name: 'QR コード' }).getAttribute('aria-selected');
check('ArrowRight switches tab', qrTabSelected === 'true');

// 7. QR generation renders a real image
await genQr();
await page.waitForSelector('.qr-image');
const img = page.locator('.qr-image');
const src = await img.getAttribute('src');
check('qr src is PNG data URL', src.startsWith('data:image/png;base64,'));
const dims = await img.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight }));
check('qr decoded by browser 256px', dims.w === 256 && dims.h === 256, `-> ${dims.w}x${dims.h}`);

// 8. Image has a meaningful alt (a11y)
const alt = await img.getAttribute('alt');
check('qr has descriptive alt', !!alt && alt.includes('QR'), `-> ${alt}`);

// 9. Error path surfaces to the user
await page.locator('#qr-text').fill('');
await genQr();
const alertText = await page.locator('[role="alert"]').innerText();
check('empty input shows error', alertText.includes('required'), `-> ${alertText}`);

// 10. State preserved when switching back
await page.getByRole('tab', { name: 'パスワード生成' }).click();
const kept = await pwValue();
check('password state preserved', kept === pw4);

// 11. WASM fetched only once despite tab switching
const wasmRequests = await page.evaluate(() =>
  performance.getEntriesByType('resource').filter((r) => r.name.endsWith('main.wasm')).length,
);
check('wasm fetched once', wasmRequests === 1, `-> ${wasmRequests}`);

// 12. No console errors
check('no console errors', errors.length === 0, errors.join(' | '));

await browser.close();
server.close();
console.log(failures === 0 ? '\nALL BROWSER TESTS PASSED' : `\n${failures} TEST(S) FAILED`);
process.exit(failures ? 1 : 0);



