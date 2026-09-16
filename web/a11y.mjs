import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const axePath = require.resolve('axe-core/axe.min.js');

const DIST = process.argv[2];
const BASE = '/go-wasm-tools/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (!p.startsWith(BASE)) return res.writeHead(404).end();
  p = p.slice(BASE.length) || 'index.html';
  const file = join(DIST, p);
  if (!existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(readFileSync(file));
});

await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}${BASE}`;

const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForSelector('.banner.loading', { state: 'detached', timeout: 20000 });

let total = 0;
for (const [label, prep] of [
  ['パスワードタブ', async () => {}],
  ['QRタブ', async () => {
    await page.getByRole('tab', { name: 'QR コード' }).click();
    await page.locator('#panel-qr').getByRole('button', { name: '生成する' }).click();
    await page.waitForSelector('.qr-image');
  }],
]) {
  await prep();
  await page.addScriptTag({ path: axePath });
  const r = await page.evaluate(async () =>
    await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }),
  );
  console.log(`\n=== ${label} ===`);
  console.log(`違反 ${r.violations.length} 件 / 合格ルール ${r.passes.length} 件`);
  for (const v of r.violations) {
    total++;
    console.log(`  [${v.impact}] ${v.id}: ${v.help}`);
    for (const n of v.nodes.slice(0, 3)) console.log(`      ${n.html.slice(0, 110)}`);
  }
}

await browser.close();
server.close();
console.log(total === 0 ? '\nNO ACCESSIBILITY VIOLATIONS' : `\n${total} VIOLATION TYPE(S)`);
process.exit(total ? 1 : 0);
