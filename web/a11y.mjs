// Accessibility audit (axe-core, WCAG 2.1 AA) of every tab in the built `dist/`.
// Usage: npm run build && npm run a11y   (see browser-harness.mjs for E2E_BROWSER)
import { createRequire } from 'node:module';
import { serveDist, launchBrowser, openApp } from './browser-harness.mjs';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Populate outputs before auditing so generated content (images, results) is covered too.
const PREPARE = {
  'tab-password': async (page, panel) => {
    await panel.getByRole('button', { name: 'UUID を生成' }).click();
    await panel.locator('pre.result').waitFor();
  },
  'tab-qr': async (page, panel) => {
    await panel.getByRole('button', { name: '生成する' }).click();
    await panel.locator('img.qr-image').first().waitFor();
  },
};

const server = await serveDist();
const browser = await launchBrowser();
console.log(`serving dist at ${server.url}`);

let violationTypes = 0;
let tabCount = 0;
try {
  const { page, errors } = await openApp(browser, server.url);
  await page.addScriptTag({ path: axePath });

  const tabs = await page.getByRole('tab').evaluateAll((els) => els.map((el) => ({ id: el.id, label: el.textContent.trim(), panel: el.getAttribute('aria-controls') })));
  if (tabs.length === 0) throw new Error('no role="tab" elements found');

  for (const t of tabs) {
    tabCount++;
    await page.locator(`#${t.id}`).click();
    const panel = page.locator(`#${t.panel}`);
    await panel.waitFor({ state: 'visible' });
    await PREPARE[t.id]?.(page, panel);

    const r = await page.evaluate(
      async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
      AXE_TAGS,
    );
    console.log(`\n=== ${t.label} ===`);
    console.log(`違反 ${r.violations.length} 件 / 合格ルール ${r.passes.length} 件 / 要確認 ${r.incomplete.length} 件`);
    for (const v of r.violations) {
      violationTypes++;
      console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.helpUrl})`);
      for (const n of v.nodes.slice(0, 5)) {
        console.log(`      ${n.target.join(' ')}`);
        console.log(`        ${n.html.slice(0, 140)}`);
        if (n.failureSummary) console.log(`        ${n.failureSummary.split('\n').join('\n        ')}`);
      }
    }
  }

  if (errors.length) {
    console.log(`\nconsole errors: ${errors.join(' | ')}`);
    violationTypes++;
  }
} finally {
  await browser.close();
  await server.close();
}

console.log(violationTypes === 0 ? `\nNO ACCESSIBILITY VIOLATIONS (${tabCount} tabs)` : `\n${violationTypes} VIOLATION TYPE(S)`);
process.exit(violationTypes ? 1 : 0);
