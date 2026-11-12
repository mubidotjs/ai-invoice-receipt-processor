// Temporary launch test harness. Remove before enabling live inference.
const worker = 'https://ai-invoice-receipt-processor.mubikhan69.workers.dev';
const sitekey = '0x4AAAAAAF9u_exNZlyI1Aql';
const result = document.querySelector('#result');
let lastToken = '';
let widget;
async function check(token) {
  if (!document.querySelector('#consent').checked) throw new Error('Explicit consent is required.');
  const response = await fetch(`${worker}/api/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Ledger-Protection-Check': '1' },
    body: JSON.stringify({
      schemaVersion: '1',
      consent: true,
      pages: [
        {
          page: 1,
          text: 'Synthetic launch protection verification. No document data or inference.',
        },
      ],
      turnstileToken: token,
    }),
  });
  result.textContent = JSON.stringify(
    { httpStatus: response.status, ...(await response.json()) },
    null,
    2,
  );
}
function error(e) {
  result.textContent = e.message;
}
document.querySelector('#verify').addEventListener('click', async () => {
  try {
    if (!document.querySelector('#consent').checked)
      throw new Error('Explicit consent is required.');
    result.textContent = 'Loading the real production Turnstile widget; inference stays disabled.';
    if (!window.turnstile)
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.onload = resolve;
        script.onerror = () => reject(new Error('Turnstile could not load.'));
        document.head.append(script);
      });
    if (widget !== undefined) window.turnstile.remove(widget);
    widget = window.turnstile.render('#challenge', {
      sitekey,
      action: 'invoice-extract',
      callback: (token) => {
        lastToken = token;
        document.querySelector('#replay').disabled = false;
        check(token).catch(error);
      },
      'error-callback': () => error(new Error('The real Turnstile challenge failed.')),
      'expired-callback': () =>
        error(new Error('The challenge expired. Request a fresh challenge.')),
    });
  } catch (e) {
    error(e);
  }
});
document.querySelector('#replay').addEventListener('click', () => check(lastToken).catch(error));
document
  .querySelector('#invalid')
  .addEventListener('click', () => check('invalid-production-protection-probe').catch(error));
