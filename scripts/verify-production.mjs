// Explicit Gate E1 verification only. No credentials, real challenges or inference.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const app = new URL(process.argv[2]);
const worker = new URL(process.argv[3]);
assert.equal(app.protocol, 'https:');
assert.equal(worker.protocol, 'https:');
const origin = app.origin;
await mkdir('.cache', { recursive: true });
const report = {
  date: new Date().toISOString(),
  origin,
  worker: worker.origin,
  documents: [],
  accessibility: [],
  assets: {},
  protection: {},
};
const response = await fetch(origin);
assert.equal(response.status, 200);
assert.match(await response.text(), /Ledger Lens/);
const csp = response.headers.get('content-security-policy') ?? '';
assert.match(csp, /object-src 'none'/);
assert.ok(!csp.includes("'unsafe-eval'"));
assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
report.headers = { status: response.status, csp, nosniff: true, noReferrer: true };

const manifestResponse = await fetch(new URL('/assets/manifest.json', origin));
assert.equal(manifestResponse.status, 200);
const assets = await manifestResponse.json();
let checked = 0;
let totalBytes = 0;
for (let i = 0; i < assets.length; i += 6)
  await Promise.all(
    assets.slice(i, i + 6).map(async (asset) => {
      const url = new URL(asset.file, origin);
      assert.equal(url.origin, origin);
      const res = await fetch(url);
      assert.equal(res.status, 200, asset.file);
      const bytes = Buffer.from(await res.arrayBuffer());
      assert.equal(bytes.length, asset.bytes, asset.file);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.file);
      checked++;
      totalBytes += bytes.length;
    }),
  );
report.assets = { checked, totalBytes, allSameOrigin: true, sha256Verified: true };
console.log(`Verified ${checked} deployed runtime assets by SHA-256.`);

const browser = await chromium.launch();
try {
  for (const fixture of [
    { id: 'harbor', vendor: 'HARBOR STUDIO', total: '165.00', methods: ['PDF text'] },
    { id: 'saffron', vendor: 'SAFFRON CAFE', total: '680.00', methods: ['OCR'] },
    { id: 'northstar', vendor: 'NORTHSTAR SUPPLY', total: '20.40', methods: ['OCR', 'OCR'] },
    { id: 'alder', vendor: 'ALDER WORKSHOP', total: '102.00', methods: ['PDF text', 'OCR'] },
    { id: 'juniper', vendor: 'JUNIPER KITCHEN', total: '37.40', methods: ['OCR'] },
    { id: 'cedar', vendor: 'CEDAR MARKET', total: '40.00', methods: ['OCR'] },
  ]) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 900 },
    });
    const unexpected = [];
    const errors = [];
    const requests = [];
    await context.route('**/*', (route) => {
      const req = route.request();
      const url = new URL(req.url());
      requests.push({ url: req.url(), method: req.method() });
      if (url.origin === origin && ['GET', 'HEAD'].includes(req.method())) return route.continue();
      unexpected.push(req.url());
      return route.abort();
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(origin);
    await page.getByRole('combobox', { name: 'Synthetic example' }).selectOption(fixture.id);
    await page.getByRole('button', { name: 'Process sample document' }).click();
    await expect(page.locator('.session-status')).toContainText('Local extraction complete', {
      timeout: 175000,
    });
    await expect(page.locator('#source-text')).toHaveValue(new RegExp(fixture.vendor));
    const methods = [];
    for (let i = 0; i < fixture.methods.length; i++) {
      if (i) await page.getByRole('button', { name: 'Next page' }).click();
      await expect(page.locator('.method-label')).toHaveText(fixture.methods[i]);
      methods.push(fixture.methods[i]);
      await expect
        .poll(() =>
          page
            .getByAltText(`Document preview, page ${i + 1}`)
            .evaluate((el) => el.complete && el.naturalWidth > 0),
        )
        .toBe(true);
    }
    await expect(page.locator('#source-text')).toHaveValue(
      new RegExp(fixture.total.replace('.', '\\.')),
    );
    await expect(page.getByRole('button', { name: 'Extract with AI' })).toBeDisabled();
    await expect(page.getByLabel('Vendor name')).toHaveValue('');
    await page.getByLabel('Vendor name').fill(fixture.vendor);
    if (fixture.id === 'harbor') {
      await page.getByLabel('Currency', { exact: true }).selectOption('USD');
      await page.getByLabel('Tax treatment').selectOption('exclusive');
      await page.getByLabel('Subtotal', { exact: true }).fill('150.00');
      await page.getByLabel('Tax total', { exact: true }).fill('15.00');
      await page.getByLabel('Total', { exact: true }).fill('164.00');
      await expect(page.locator('.check-list li').filter({ hasText: 'GRAND TOTAL' })).toHaveClass(
        'warning',
      );
      await page.getByLabel('Total', { exact: true }).fill(fixture.total);
      await expect(page.locator('.check-list li').filter({ hasText: 'GRAND TOTAL' })).toHaveClass(
        'pass',
      );
    }
    await page.getByLabel('Total', { exact: true }).fill('invalid');
    await page.getByRole('checkbox', { name: /I reviewed this revision/ }).check();
    await page.getByRole('checkbox', { name: /I acknowledge/ }).check();
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    await page.getByLabel('Total', { exact: true }).fill(fixture.total);
    await expect(
      page.getByRole('checkbox', { name: /I reviewed this revision/ }),
    ).not.toBeChecked();
    await page.getByRole('checkbox', { name: /I reviewed this revision/ }).check();
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /I acknowledge/ }).check();
    const jsonDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const record = JSON.parse(await readFile(await (await jsonDownload).path(), 'utf8'));
    assert.equal(record.data.vendorName, fixture.vendor);
    assert.equal(record.data.total, fixture.total);
    assert.equal(record.processing.synthetic, true);
    assert.equal(record.processing.mode, 'manual');
    assert.equal(record.provenance['/vendorName'].origin, 'manual-entry');
    assert.ok(record.review.acknowledgedWarningCodes.length > 0);
    const csvDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = await readFile(await (await csvDownload).path(), 'utf8');
    assert.ok(csv.includes(fixture.vendor));
    assert.ok(csv.includes(fixture.total));
    assert.ok(csv.includes('field_provenance_json'));
    assert.deepEqual(unexpected, []);
    assert.deepEqual(errors, []);
    assert.ok(
      requests.some((r) => r.url.includes('/assets/pdf/')) ||
        fixture.methods.every((m) => m === 'OCR'),
    );
    if (fixture.methods.includes('OCR'))
      assert.ok(requests.some((r) => r.url.includes('/assets/ocr/')));
    report.documents.push({
      id: fixture.id,
      methods,
      json: true,
      csv: true,
      manualProvenance: true,
      synthetic: true,
      externalRequests: unexpected.length,
      requestCount: requests.length,
    });
    console.log(`Production workflow passed: ${fixture.id} (${methods.join(' + ')}).`);
    await context.close();
  }
  for (const width of [390, 768, 1280]) {
    const context = await browser.newContext({
      serviceWorkers: 'block',
      viewport: { width, height: 900 },
    });
    const page = await context.newPage();
    await context.route('**/*', (route) =>
      new URL(route.request().url()).origin === origin ? route.continue() : route.abort(),
    );
    await page.goto(origin);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to document workspace' })).toBeFocused();
    await page.getByRole('button', { name: 'Load sample result' }).click();
    await expect(page.getByText('SAMPLE RESULT', { exact: true })).toBeVisible();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const scan = await new AxeBuilder({ page }).analyze();
    const violations = scan.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    assert.deepEqual(violations, []);
    report.accessibility.push({
      width,
      overflow: false,
      seriousOrCriticalViolations: 0,
      keyboardSkipLink: true,
    });
    if (width === 1280) {
      await page.evaluate(() =>
        scrollTo(
          0,
          document.querySelector('#workspace').getBoundingClientRect().top + scrollY - 20,
        ),
      );
      await page.screenshot({ path: '.cache/e1-production-workspace.png' });
    }
    await context.close();
  }
} finally {
  await browser.close();
}

const healthRes = await fetch(new URL('/health', worker));
assert.equal(healthRes.status, 200);
const health = await healthRes.json();
assert.equal(health.liveEnabled, false);
const endpoint = new URL('/api/extract', worker);
const preflight = await fetch(endpoint, {
  method: 'OPTIONS',
  headers: {
    Origin: origin,
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'Content-Type',
  },
});
assert.equal(preflight.status, 204);
assert.equal(preflight.headers.get('access-control-allow-origin'), origin);
const rejected = await fetch(endpoint, {
  method: 'OPTIONS',
  headers: { Origin: 'https://unapproved.invalid', 'Access-Control-Request-Method': 'POST' },
});
assert.equal(rejected.status, 403);
assert.equal(rejected.headers.get('access-control-allow-origin'), null);
const malformed = await fetch(endpoint, {
  method: 'POST',
  headers: { Origin: origin, 'Content-Type': 'application/json' },
  body: JSON.stringify({ rawFile: 'SYNTHETIC_REJECTION_TEST' }),
});
assert.equal(malformed.status, 400);
const attempts = [];
for (let i = 0; i < 6; i++) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schemaVersion: '1',
      consent: true,
      pages: [
        { page: 1, text: 'Synthetic Gate E1 disabled-path test. No model processing authorized.' },
      ],
      turnstileToken: 'deliberately-invalid-e1-token',
    }),
  });
  const body = await res.json();
  assert.ok([503, 429].includes(res.status));
  assert.ok(['LIVE_AI_DISABLED', 'RATE_LIMITED'].includes(body.error.code));
  attempts.push({ status: res.status, code: body.error.code });
  if (res.status === 429) {
    assert.ok(res.headers.get('retry-after'));
    break;
  }
}
assert.ok(attempts.some((a) => a.code === 'LIVE_AI_DISABLED'));
assert.ok(attempts.some((a) => a.code === 'RATE_LIMITED'));
report.protection = {
  health,
  preflight: 204,
  deniedOrigin: 403,
  malformedRequest: 400,
  attempts,
  aggregateExhaustionTested: false,
  realTurnstileVerification: false,
  realInference: false,
};
await writeFile('.cache/e1-production-report.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  `Gate E1 public verification passed. Report: ${resolve('.cache/e1-production-report.json')}`,
);
