// Browser end-to-end tests against the built `dist/`.
// Usage: npm run build && npm run e2e   (see browser-harness.mjs for E2E_BROWSER)
import { createHmac } from 'node:crypto';
import { serveDist, launchBrowser, openApp, reporter } from './browser-harness.mjs';

// Mirrors TABS in src/App.tsx; "tab list matches" below fails if they drift apart.
const TABS = [
  { id: 'password', label: 'パスワード / UUID 生成（crypto/rand）' },
  { id: 'hash', label: 'ハッシュ計算 SHA-256・bcrypt（crypto/*）' },
  { id: 'jwt', label: 'JWT のデコードと署名検証' },
  { id: 'convert', label: 'JSON ⇄ YAML 相互変換' },
  { id: 'regex', label: '正規表現テスター' },
  { id: 'qr', label: 'QR コード' },
];

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function hs256Token(payloadJSON, secret) {
  const b64 = (s) => Buffer.from(s).toString('base64url');
  const message = `${b64('{"alg":"HS256","typ":"JWT"}')}.${b64(payloadJSON)}`;
  return `${message}.${createHmac('sha256', secret).update(message).digest('base64url')}`;
}

const report = reporter();
const { check } = report;
const server = await serveDist();
const browser = await launchBrowser();
console.log(`serving dist at ${server.url}`);

try {
  const { page, errors } = await openApp(browser, server.url);
  const tab = (id) => page.getByRole('tab', { name: TABS.find((t) => t.id === id).label, exact: true });
  const panel = (id) => page.locator(`#panel-${id}`);
  const selectedTab = () => page.getByRole('tab', { selected: true }).getAttribute('id');
  const focusedId = () => page.evaluate(() => document.activeElement?.id ?? '');

  // (a) WASM loaded and the password tool generated on load
  check('wasm loaded (loading banner gone)', true);
  const pw = await panel('password').locator('output.result').innerText();
  check('password auto-generated (20 chars)', pw.length === 20, `-> ${pw}`);

  // (b) Tab list matches App.tsx and each tab shows exactly its own panel
  const names = await page.getByRole('tab').allInnerTexts();
  check('tab list matches App.tsx TABS', JSON.stringify(names) === JSON.stringify(TABS.map((t) => t.label)), `-> ${names.join(' | ')}`);
  for (const t of TABS) {
    await tab(t.id).click();
    const visible = await Promise.all(TABS.map((o) => panel(o.id).isVisible()));
    const onlyOwn = visible.every((v, i) => v === (TABS[i].id === t.id));
    const selected = await tab(t.id).getAttribute('aria-selected');
    check(`tab "${t.label}" selects only its panel`, onlyOwn && selected === 'true');
  }

  // (c) Keyboard navigation (WAI-ARIA tabs): Arrow keys wrap, Home/End jump
  await tab('password').click();
  await tab('password').focus();
  await page.keyboard.press('ArrowRight');
  check('ArrowRight moves to next tab', (await selectedTab()) === 'tab-hash' && (await focusedId()) === 'tab-hash');
  await page.keyboard.press('ArrowLeft');
  check('ArrowLeft moves back', (await selectedTab()) === 'tab-password');
  await page.keyboard.press('ArrowLeft');
  check('ArrowLeft wraps to last tab', (await selectedTab()) === 'tab-qr');
  await page.keyboard.press('ArrowRight');
  check('ArrowRight wraps to first tab', (await selectedTab()) === 'tab-password');
  await page.keyboard.press('End');
  check('End selects last tab', (await selectedTab()) === 'tab-qr' && (await focusedId()) === 'tab-qr');
  await page.keyboard.press('Home');
  check('Home selects first tab', (await selectedTab()) === 'tab-password' && (await focusedId()) === 'tab-password');
  const tabIndexes = await page.getByRole('tab').evaluateAll((els) => els.map((el) => el.tabIndex));
  check('roving tabindex (only active tab is 0)', tabIndexes.filter((i) => i === 0).length === 1);

  // (d) One happy path per tool
  // UUID (same panel as password)
  await panel('password').getByRole('button', { name: 'UUID を生成' }).click();
  const uuid = (await panel('password').locator('pre.result').innerText()).trim();
  check('uuid v4 format', UUID_V4.test(uuid), `-> ${uuid}`);

  // SHA-256
  await tab('hash').click();
  await page.locator('#hash-text').fill('abc');
  await panel('hash').getByRole('button', { name: 'ハッシュを計算' }).click();
  const digest = await panel('hash').locator('output.result').innerText();
  check('sha256("abc") known vector', digest === SHA256_ABC, `-> ${digest}`);

  // JWT decode + HS256 verify
  await tab('jwt').click();
  await page.locator('#jwt-token').fill(hs256Token('{"sub":"e2e","large":9007199254740993}', 'secret'));
  await page.locator('#jwt-key').fill('secret');
  await panel('jwt').getByRole('button', { name: '署名を検証' }).click();
  const jwtStatus = await panel('jwt').getByRole('status').innerText();
  const jwtPayload = await panel('jwt').locator('pre.result').nth(1).innerText();
  check('jwt verified', jwtStatus.includes('署名検証に成功'), `-> ${jwtStatus}`);
  check('jwt payload decoded (large int preserved)', jwtPayload.includes('"sub"') && jwtPayload.includes('9007199254740993'), `-> ${jwtPayload.replace(/\n/g, '\\n')}`);

  // JSON -> YAML
  await tab('convert').click();
  await page.locator('#convert-input').fill('{"name":"日本語","list":[1,2]}');
  await panel('convert').getByRole('button', { name: '変換する' }).click();
  const yaml = await panel('convert').locator('pre.result').innerText();
  check('json -> yaml', yaml.includes('日本語') && /list.*\n\s*- 1\n\s*- 2/.test(yaml), `-> ${yaml.replace(/\n/g, '\\n')}`);

  // Regex: exactly one match with a named group
  await tab('regex').click();
  await page.locator('#regex-pattern').fill('(?P<lang>Go)');
  await page.locator('#regex-text').fill('Hello, Go!');
  await panel('regex').getByRole('button', { name: 'テストする' }).click();
  const regexStatus = await panel('regex').getByRole('status').innerText();
  const regexMatch = await panel('regex').locator('.match-result').first().innerText();
  check('regex one match', regexStatus.startsWith('1 件の一致'), `-> ${regexStatus}`);
  check('regex named group listed', regexMatch.includes('(lang)') && regexMatch.includes('"Go"'));

  // QR generate
  await tab('qr').click();
  const qrText = 'https://nasuton.github.io/';
  await page.locator('#qr-text').fill(qrText);
  await panel('qr').getByRole('button', { name: '生成する' }).click();
  const qrImg = panel('qr').locator('img.qr-image:not(.qr-upload-preview)');
  await qrImg.waitFor();
  const src = await qrImg.getAttribute('src');
  check('qr src is PNG data URL', src.startsWith('data:image/png;base64,'));
  const dims = await qrImg.evaluate((el) => ({ w: el.naturalWidth, h: el.naturalHeight }));
  check('qr image decodes at 256px', dims.w === 256 && dims.h === 256, `-> ${dims.w}x${dims.h}`);
  check('qr image has descriptive alt', ((await qrImg.getAttribute('alt')) ?? '').includes('QR'));

  // QR read: round-trip the generated PNG through the decoder
  const reader = panel('qr').locator('section[aria-labelledby="qr-reader-heading"]');
  await page.locator('#qr-file').setInputFiles({
    name: 'qrcode.png',
    mimeType: 'image/png',
    buffer: Buffer.from(src.split(',')[1], 'base64'),
  });
  await reader.getByRole('button', { name: '画像を読み取る' }).click();
  const decoded = await reader.locator('pre.result').innerText({ timeout: 15000 });
  check('qr round-trip decodes the same text', decoded === qrText, `-> ${decoded}`);
  check('qr result offers HTTP(S) link', await reader.getByRole('link', { name: 'URL を新しいタブで開く' }).isVisible());

  // State survives tab switching and WASM was fetched only once
  await tab('password').click();
  check('password state preserved across tabs', (await panel('password').locator('output.result').innerText()) === pw);
  const wasmFetches = await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => r.name.endsWith('main.wasm')).length);
  check('main.wasm fetched once', wasmFetches === 1, `-> ${wasmFetches}`);

  // (e) No console / page / network errors
  check('no console errors', errors.length === 0, errors.join(' | '));
} finally {
  await browser.close();
  await server.close();
}

console.log(report.failures === 0 ? '\nALL BROWSER TESTS PASSED' : `\n${report.failures} TEST(S) FAILED`);
process.exit(report.failures ? 1 : 0);
