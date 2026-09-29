// Shared setup for e2e.mjs and a11y.mjs: serve the built `dist/` at the base path
// it was built with, and launch a Chromium-family browser via playwright-core.
//
//   E2E_BROWSER=chromium  (default) Playwright's Chromium; install once with
//                         `npx playwright-core install chromium` (`--with-deps` on Linux CI)
//   E2E_BROWSER=msedge    Locally installed Microsoft Edge (handy on Windows)
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIST = join(dirname(fileURLToPath(import.meta.url)), 'dist');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

/** Reads the `base` Vite built `dist/` with, so tests work for any `--base`. */
export function readDistBase() {
  const indexPath = join(DIST, 'index.html');
  if (!existsSync(indexPath)) {
    throw new Error(`${indexPath} not found. Run \`npm run build\` first.`);
  }
  const html = readFileSync(indexPath, 'utf8');
  const m = html.match(/<script[^>]+src="([^"]*?)assets\//);
  return m ? m[1] : '/';
}

/** Serves `dist/` under `base` like GitHub Pages does. Resolves to the page URL. */
export async function serveDist() {
  const base = readDistBase();
  const server = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (!p.startsWith(base)) {
      res.writeHead(404).end('outside base');
      return;
    }
    p = p.slice(base.length) || 'index.html';
    const file = normalize(join(DIST, p));
    if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}${base}`;
  return { url, base, close: () => new Promise((r) => server.close(r)) };
}

export async function launchBrowser() {
  const kind = process.env.E2E_BROWSER ?? 'chromium';
  const options = { headless: true };
  if (kind === 'msedge') options.channel = 'msedge';
  else if (kind !== 'chromium') throw new Error(`Unknown E2E_BROWSER=${kind} (use chromium or msedge)`);
  try {
    return await chromium.launch(options);
  } catch (e) {
    const hint =
      kind === 'chromium'
        ? 'Install it with `npx playwright-core install chromium`, or set E2E_BROWSER=msedge to use Edge.'
        : 'Make sure Microsoft Edge is installed, or unset E2E_BROWSER to use Playwright Chromium.';
    throw new Error(`Failed to launch ${kind}: ${e.message}\n${hint}`);
  }
}

/**
 * Opens the app, waits for the WASM banner to disappear and collects console errors.
 * Returns the page plus the list of errors observed so far.
 */
export async function openApp(browser, url) {
  const page = await browser.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('requestfailed', (r) => errors.push(`request failed: ${r.url()}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.banner.loading', { state: 'detached', timeout: 30000 });
  return { page, errors };
}

/** Minimal PASS/FAIL reporter shared by both scripts. */
export function reporter() {
  let failures = 0;
  const check = (name, cond, extra = '') => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
    if (!cond) failures++;
  };
  return { check, get failures() { return failures; } };
}
