import { afterEach, expect, it, vi } from 'vitest';
import { extract } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each([
  ['AI_CAPACITY', 'capacity is unavailable'],
  ['AI_MODEL_UNAVAILABLE', 'selected model is unavailable'],
  ['AI_UNAVAILABLE', 'model request failed'],
  ['PROTECTION_UNAVAILABLE', 'bot verification is unavailable'],
  ['INPUT_TOO_LARGE', 'input is too large'],
  ['INTERNAL_ERROR', 'service could not process this request'],
])(
  'reports safe %s feedback without retrying or losing the backend code',
  async (code, message) => {
    vi.stubEnv('VITE_WORKER_URL', 'https://worker.example');
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code, message: 'private provider details must not be echoed' },
        }),
        { status: 503 },
      ),
    );
    vi.stubGlobal('fetch', fetcher);
    await expect(
      extract(
        [{ page: 1, text: 'Synthetic client failure test.' }],
        'mock-token',
        new AbortController().signal,
      ),
    ).rejects.toThrow(new RegExp(`${message}.*${code}`));
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);

it('never echoes an unknown remote error code or provider message', async () => {
  vi.stubEnv('VITE_WORKER_URL', 'https://worker.example');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: 'untrusted remote text', message: 'private provider details' },
        }),
        { status: 502 },
      ),
    ),
  );
  await expect(
    extract(
      [{ page: 1, text: 'Synthetic client failure test.' }],
      'mock-token',
      new AbortController().signal,
    ),
  ).rejects.toThrow(
    'Cloud extraction is unavailable. Your document and manual entries remain local.',
  );
});
