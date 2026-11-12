import {
  LIMITS,
  normalizeText,
  requestSchema,
  responseSchema,
  validateAIOutput,
  type TextPage,
} from '@invoice/shared';
type Turnstile = {
  render(container: HTMLElement, options: Record<string, unknown>): string;
  remove(id: string): void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
export const aiAvailable = () => import.meta.env.VITE_LIVE_AI_ENABLED === 'true';
const isTestKey = (s: string) => /^[123]x0+/i.test(s);
export function workerUrl(): string {
  const url = new URL(import.meta.env.VITE_WORKER_URL || 'http://127.0.0.1:8788');
  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  )
    throw new Error('Invalid Worker configuration.');
  return url.origin;
}
export async function challenge(container: HTMLElement, signal: AbortSignal): Promise<string> {
  if (signal.aborted) throw new Error('Verification canceled.');
  const key = String(import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '');
  if (!key || isTestKey(key))
    throw new Error('Production bot verification is not configured. Continue manually.');
  if (!window.turnstile)
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      const finish = (error?: string) => {
        clearTimeout(timer);
        signal.removeEventListener('abort', aborted);
        script.onload = null;
        script.onerror = null;
        if (error) {
          script.remove();
          reject(new Error(error));
        } else resolve();
      };
      const aborted = () => finish('Verification canceled.');
      const timer = setTimeout(
        () => finish('Bot verification timed out. Continue manually.'),
        15000,
      );
      script.onload = () => finish();
      script.onerror = () =>
        finish('Bot verification could not load. Local processing remains available.');
      signal.addEventListener('abort', aborted, { once: true });
      document.head.append(script);
    });
  if (signal.aborted) throw new Error('Verification canceled.');
  return new Promise<string>((resolve, reject) => {
    const handle: { id?: string; settled: boolean } = { settled: false };
    const finish = (error?: string, token?: string) => {
      if (handle.settled) return;
      handle.settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', aborted);
      if (handle.id) window.turnstile?.remove(handle.id);
      if (error) reject(new Error(error));
      else resolve(token!);
    };
    const aborted = () => finish('Verification canceled.');
    const timer = setTimeout(
      () => finish('Bot verification timed out. Try explicitly again.'),
      120000,
    );
    signal.addEventListener('abort', aborted, { once: true });
    try {
      handle.id = window.turnstile!.render(container, {
        sitekey: key,
        action: 'invoice-extract',
        callback: (token: string) => finish(undefined, token),
        'error-callback': () => finish('Bot verification failed. Continue manually or try again.'),
        'expired-callback': () => finish('Bot verification expired. Start a fresh attempt.'),
      });
      if (handle.settled) window.turnstile?.remove(handle.id);
    } catch {
      finish('Bot verification could not start. Continue manually.');
    }
  });
}
export async function extract(pages: TextPage[], token: string, signal: AbortSignal) {
  const payload = requestSchema.parse({
    schemaVersion: '1',
    consent: true,
    pages: pages.map((p) => ({ ...p, text: normalizeText(p.text) })),
    turnstileToken: token,
  });
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal.aborted) abort();
  else signal.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, LIMITS.browserMs);
  try {
    const response = await fetch(workerUrl() + '/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
    });
    const reader = response.body?.getReader();
    if (!reader) throw new Error('AI returned no response. Continue manually.');
    let bytes = 0;
    let body = '';
    const decoder = new TextDecoder();
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.length;
        if (bytes > LIMITS.outputBytes)
          throw new Error('AI response exceeded the size limit. Continue manually.');
        body += decoder.decode(item.value, { stream: true });
      }
      body += decoder.decode();
    } finally {
      await reader.cancel().catch(() => undefined);
      reader.releaseLock();
    }
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      throw new Error('AI returned invalid JSON. No draft was applied; continue manually.');
    }
    if (!response.ok) {
      const error = json as { error?: { code?: string } };
      const messages: Record<string, string> = {
        LIVE_AI_DISABLED: 'Cloud AI is disabled. Continue with manual entry.',
        RATE_LIMITED: 'Too many requests. Wait before trying explicitly again.',
        AI_QUOTA_EXHAUSTED: 'The shared free AI quota is exhausted. Continue manually.',
        AI_INVALID_OUTPUT: 'AI output failed validation. No draft was applied; continue manually.',
        TURNSTILE_REJECTED: 'Verification expired or failed. Start a fresh attempt.',
        AI_TIMEOUT:
          'AI timed out. Provider computation may already have started. Continue manually.',
      };
      throw new Error(
        messages[error.error?.code ?? ''] ??
          'Cloud extraction is unavailable. Your document and manual entries remain local.',
      );
    }
    try {
      const parsed = responseSchema.parse(json);
      validateAIOutput({ data: parsed.data, evidence: parsed.evidence }, payload.pages);
      return parsed;
    } catch {
      throw new Error(
        'AI returned invalid or unsupported data. No draft was applied; continue manually.',
      );
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw new Error(
        'AI request canceled or timed out. Text already transmitted cannot be retracted.',
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  }
}
