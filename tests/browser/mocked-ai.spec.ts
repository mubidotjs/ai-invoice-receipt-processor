import { test, expect, type Route } from '@playwright/test';
import { blankDocument, MODEL, PROMPT_VERSION } from '../../shared/src/schema';
test.use({ baseURL: 'http://127.0.0.1:5402' });
const output = () => ({
  schemaVersion: '1',
  mode: 'live-ai',
  model: MODEL,
  promptVersion: PROMPT_VERSION,
  data: { ...blankDocument(), vendorName: 'HARBOR STUDIO', total: '165.00' },
  evidence: [
    { path: '/vendorName', page: 1, quote: 'HARBOR STUDIO' },
    { path: '/total', page: 1, quote: 'TOTAL USD 165.00' },
  ],
  checks: [],
});
for (const behavior of ['success', 'disabled', 'quota', 'invalid', 'late'] as const)
  test(`browser with mocked widget and mocked AI: ${behavior}`, async ({ page, context }) => {
    let calls = 0;
    let widgetCalls = 0;
    const unexpected: string[] = [];
    let pending: Route | undefined;
    await context.route('**/*', async (route) => {
      const u = new URL(route.request().url());
      if (u.hostname === '127.0.0.1' && u.port === '5402') return route.continue();
      if (u.hostname === 'challenges.cloudflare.com' && u.pathname.endsWith('/api.js')) {
        widgetCalls++;
        return route.fulfill({
          contentType: 'text/javascript',
          body: 'window.turnstile={render:(el,opts)=>{setTimeout(()=>opts.callback("browser-mock-token"),5);return "mock-widget";},remove:()=>{}};',
        });
      }
      if (u.origin === 'http://127.0.0.1:8788' && u.pathname === '/api/extract') {
        const cors = {
          'Access-Control-Allow-Origin': 'http://127.0.0.1:5402',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Allow-Methods': 'POST',
        };
        if (route.request().method() === 'OPTIONS')
          return route.fulfill({ status: 204, headers: cors });
        calls++;
        const body = route.request().postDataJSON();
        expect(Object.keys(body).sort()).toEqual([
          'consent',
          'pages',
          'schemaVersion',
          'turnstileToken',
        ]);
        expect(body.consent).toBe(true);
        expect(body.turnstileToken).toBe('browser-mock-token');
        expect(body.pages[0].text).toContain('HARBOR STUDIO');
        if (behavior === 'late') {
          pending = route;
          return;
        }
        if (behavior === 'disabled' || behavior === 'quota')
          return route.fulfill({
            status: 503,
            headers: cors,
            json: {
              error: { code: behavior === 'disabled' ? 'LIVE_AI_DISABLED' : 'AI_QUOTA_EXHAUSTED' },
            },
          });
        const result = output();
        if (behavior === 'invalid') result.data.total = '999.00';
        return route.fulfill({ headers: cors, json: result });
      }
      unexpected.push(route.request().url());
      return route.abort();
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Load sample result' }).click();
    expect(calls).toBe(0);
    expect(widgetCalls).toBe(0);
    await expect(page.getByRole('button', { name: 'Extract with AI' })).toBeDisabled();
    await page.getByRole('checkbox', { name: /I approve sending/ }).check();
    await page.getByRole('button', { name: 'Extract with AI' }).click();
    await expect.poll(() => calls).toBe(1);
    if (behavior === 'success') {
      await expect(page.getByText('CLOUD AI DRAFT', { exact: true })).toBeVisible();
      await page.getByLabel('Total', { exact: true }).fill('160.00');
      await page.getByLabel('Total', { exact: true }).focus();
      await expect(page.locator('.evidence-panel')).toContainText(
        'Manual entries and corrections do not require AI evidence',
      );
    } else if (behavior === 'late') {
      await page.getByLabel('Vendor name').fill('Preserve manual correction');
      await pending!
        .fulfill({
          headers: { 'Access-Control-Allow-Origin': 'http://127.0.0.1:5402' },
          json: output(),
        })
        .catch(() => undefined);
      await expect(page.getByLabel('Vendor name')).toHaveValue('Preserve manual correction');
    } else {
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByLabel('Vendor name')).toHaveValue('HARBOR STUDIO');
    }
    await page.getByRole('checkbox', { name: /I reviewed this revision/ }).check();
    const ack = page.getByRole('checkbox', { name: /I acknowledge/ });
    if (await ack.count()) await ack.check();
    await expect(page.getByRole('button', { name: 'Download JSON' })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Download CSV' })).toBeEnabled();
    expect(calls).toBe(1);
    expect(widgetCalls).toBe(1);
    expect(unexpected).toEqual([]);
  });
