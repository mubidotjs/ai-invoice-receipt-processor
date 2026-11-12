import { test, expect, type BrowserContext, type Download, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { authoredDraft } from '../helpers/authored-evidence';
import { validateAIOutput } from '../../shared/src/evidence';
const external: string[] = [];
async function blockExternal(context: BrowserContext) {
  await context.route('**/*', (route) => {
    const u = new URL(route.request().url());
    if (
      u.protocol === 'blob:' ||
      u.protocol === 'data:' ||
      (u.hostname === '127.0.0.1' && u.port === '5401')
    )
      return route.continue();
    external.push(route.request().url());
    return route.abort('blockedbyclient');
  });
}
test.beforeEach(async ({ context }) => {
  external.length = 0;
  await blockExternal(context);
});
test.afterEach(() =>
  expect(external, 'Local workflows attempted external network access').toEqual([]),
);
async function downloaded(download: Download) {
  return readFile((await download.path())!, 'utf8');
}
async function acknowledge(page: Page) {
  await page.getByRole('checkbox', { name: /I reviewed this revision/ }).check();
  const warning = page.getByRole('checkbox', { name: /I acknowledge/ });
  if (await warning.count()) await warning.check();
}
const fixtures = [
  {
    id: 'harbor',
    file: 'harbor.pdf',
    anchor: 'HARBOR STUDIO',
    method: 'PDF text',
    total: '165.00',
  },
  { id: 'saffron', file: 'saffron.png', anchor: 'SAFFRON CAFE', method: 'OCR', total: '680.00' },
  {
    id: 'northstar',
    file: 'northstar.pdf',
    anchor: 'NORTHSTAR SUPPLY',
    method: 'OCR',
    total: '20.40',
    pages: 2,
  },
  {
    id: 'alder',
    file: 'alder.pdf',
    anchor: 'ALDER WORKSHOP',
    method: 'PDF text',
    total: '102.00',
    pages: 2,
  },
  { id: 'juniper', file: 'juniper.jpg', anchor: 'JUNIPER KITCHEN', method: 'OCR', total: '37.40' },
  { id: 'cedar', file: 'cedar.png', anchor: 'CEDAR MARKET', method: 'OCR', total: '40.00' },
];
for (const fixture of fixtures)
  test(`externally blocked actual processing: ${fixture.id}`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await page
      .getByLabel('Choose an invoice or receipt')
      .setInputFiles(resolve('fixtures/documents', fixture.file));
    await expect(page.locator('.session-status')).toContainText('Local extraction complete', {
      timeout: 170000,
    });
    await expect(page.locator('.method-label')).toHaveText(fixture.method);
    await expect(page.getByRole('textbox', { name: /Extracted text/ })).toHaveValue(
      new RegExp(fixture.anchor),
    );
    await expect(page.getByAltText('Document preview, page 1')).toBeVisible();
    if (fixture.id === 'harbor' || fixture.id === 'saffron') {
      // Real PDF.js/Tesseract text, never the ideal authored transcription.
      const text = await page.locator('#source-text').inputValue();
      const { draft, pages } = authoredDraft(fixture.id, [{ page: 1, text }]);
      expect(validateAIOutput(draft, pages).data).toEqual(draft.data);
      expect(draft.evidence.every((e) => pages[e.page - 1]!.text.includes(e.quote))).toBe(true);
      // Coverage remains mandatory on actual OCR text too.
      draft.evidence = draft.evidence.filter((e) => e.path !== '/documentType');
      expect(() => validateAIOutput(draft, pages)).toThrow('Model output was rejected.');
    }
    expect(
      await page
        .getByAltText('Document preview, page 1')
        .evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0),
    ).toBe(true);
    if (fixture.pages) {
      await page.getByRole('button', { name: 'Next page' }).click();
      await expect(page.locator('.method-label')).toHaveText('OCR');
    }
    await expect(page.locator('#source-text')).toHaveValue(
      new RegExp(fixture.total.replace('.', '\\.')),
    );
    // Real processing must not secretly populate deterministic values.
    await expect(page.getByLabel('Vendor name')).toHaveValue('');
    await page.getByLabel('Vendor name').fill(fixture.anchor);
    await page.getByLabel('Total', { exact: true }).fill('invalid');
    await acknowledge(page);
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeDisabled();
    await page.getByLabel('Total', { exact: true }).fill(fixture.total);
    await expect(
      page.getByRole('checkbox', { name: /I reviewed this revision/ }),
    ).not.toBeChecked();
    await acknowledge(page);
    const j = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download JSON' }).click();
    const record = JSON.parse(await downloaded(await j));
    expect(record.data.vendorName).toBe(fixture.anchor);
    expect(record.provenance['/vendorName'].origin).toBe('manual-entry');
    expect(record.processing.mode).toBe('manual');
    expect(record.review.acknowledgedWarningCodes.length).toBeGreaterThan(0);
    const c = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    const csv = await downloaded(await c);
    expect(csv).toContain(fixture.anchor);
    expect(csv).toContain('field_provenance_json');
    expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
    expect(await page.evaluate(async () => (await indexedDB.databases()).length)).toBe(0);
    expect(context.serviceWorkers()).toHaveLength(0);
    expect(errors).toEqual([]);
  });
test('explicit sample result, correction provenance, warning acknowledgment and review reset', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Synthetic example' }).selectOption('juniper');
  await page.getByRole('button', { name: 'Load sample result' }).click();
  await expect(page.getByText('SAMPLE RESULT', { exact: true })).toBeVisible();
  await expect(page.locator('.session-status')).toContainText('No OCR or AI ran');
  await page.getByLabel('Total', { exact: true }).fill('36.40');
  await acknowledge(page);
  await page.getByLabel('Tip', { exact: true }).fill('4.50');
  await expect(page.getByRole('checkbox', { name: /I reviewed/ })).not.toBeChecked();
  await acknowledge(page);
  const d = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const record = JSON.parse(await downloaded(await d));
  expect(record.provenance['/total'].origin).toBe('manual-correction');
  expect(record.provenance['/total'].evidence).toBeUndefined();
  expect(record.processing.synthetic).toBe(true);
  expect(record.processing.textMethods).toEqual(['Bundled sample text']);
  await page.getByRole('button', { name: 'Clear session' }).click();
  await expect(page.getByLabel('Vendor name')).toHaveValue('');
});
for (const width of [390, 768, 1280])
  test(`responsive keyboard and accessibility ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to document workspace' })).toBeFocused();
    await page.getByRole('button', { name: 'Load sample result' }).click();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')),
    ).toEqual([]);
    await page.screenshot({ path: `test-results/ledger-lens-${width}.png`, fullPage: true });
  });
test('rejects spoofed, corrupt, encrypted and over-limit documents', async ({ page }) => {
  await page.goto('/');
  const upload = page.getByLabel('Choose an invoice or receipt');
  for (const file of [
    { name: 'fake.png', mimeType: 'image/png', buffer: Buffer.from('<svg></svg>') },
    { name: 'corrupt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7\ninvalid') },
    { name: 'too-big.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]) {
    await upload.setInputFiles(file);
    await expect(page.getByRole('alert')).toBeVisible();
    await page.getByRole('button', { name: 'Clear session' }).click();
  }
  const doc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) doc.addPage();
  await upload.setInputFiles({
    name: 'four-pages.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.getByRole('alert')).toContainText('at most three pages');
  await page.getByRole('button', { name: 'Clear session' }).click();
  await upload.setInputFiles(resolve('tests/fixtures/encrypted.pdf'));
  await expect(page.getByRole('alert')).toContainText('encrypted');
});
test('cancel does not apply a late result; native PDF can be explicitly OCRed', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Synthetic example' }).selectOption('saffron');
  await page.getByRole('button', { name: 'Process sample document' }).click();
  await page.getByRole('button', { name: 'Cancel processing' }).click();
  await page.getByRole('button', { name: 'Load sample result' }).click();
  await expect(page.getByLabel('Vendor name')).toHaveValue('SAFFRON CAFE');
  await page.getByRole('combobox', { name: 'Synthetic example' }).selectOption('harbor');
  await page.getByRole('button', { name: 'Process sample document' }).click();
  await expect(page.locator('.session-status')).toContainText('Local extraction complete', {
    timeout: 60000,
  });
  await page.getByRole('button', { name: 'Run OCR on this page' }).click();
  await expect(page.locator('.session-status')).toContainText('OCR replaced', { timeout: 120000 });
  await expect(page.locator('.method-label')).toHaveText('OCR');
  await expect(page.locator('#source-text')).toHaveValue(/HARBOR STUDIO/);
  const before = await page
    .getByAltText('Document preview, page 1')
    .evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]);
  await page.getByRole('button', { name: 'Rotate 90° & OCR' }).click();
  await expect(page.locator('.session-status')).toContainText('OCR replaced', { timeout: 120000 });
  await expect
    .poll(() =>
      page
        .getByAltText('Document preview, page 1')
        .evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight]),
    )
    .toEqual([before[1], before[0]]);
});
test('PDF JavaScript and remote actions are never executed', async ({ page }) => {
  const doc = await PDFDocument.load(await readFile(resolve('fixtures/documents/harbor.pdf')));
  doc.addJavaScript(
    'synthetic-security-probe',
    'window.__documentExecuted=true; fetch("https://malicious.invalid/document-action")',
  );
  await page.goto('/');
  await page.getByLabel('Choose an invoice or receipt').setInputFiles({
    name: 'synthetic-actions.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(await doc.save()),
  });
  await expect(page.locator('.session-status')).toContainText('Local extraction complete');
  expect(await page.evaluate(() => '__documentExecuted' in window)).toBe(false);
});
