import { describe, expect, it, vi } from 'vitest';
import {
  assertLocalText,
  canvasSize,
  checkDimensions,
  identifyFile,
  imageDimensions,
  timed,
  usableNativeText,
} from './processor';
describe('file resource boundaries', () => {
  it('requires matching signature, extension and supplied MIME', () => {
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(identifyFile('image.png', 'image/png', png)).toBe('png');
    expect(identifyFile('image.png', '', png)).toBe('png');
    for (const [name, mime] of [
      ['image.jpg', 'image/jpeg'],
      ['image.svg', 'image/svg+xml'],
      ['image.png', 'application/pdf'],
    ])
      expect(() => identifyFile(name!, mime!, png)).toThrow();
    expect(identifyFile('file.pdf', 'application/pdf', new TextEncoder().encode('%PDF-1.7'))).toBe(
      'pdf',
    );
    expect(() => identifyFile('file.pdf', 'application/pdf', new Uint8Array([1, 2, 3]))).toThrow();
  });
  it('reads PNG dimensions before decoding and rejects large allocation requests', () => {
    const bytes = new Uint8Array(24);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 20000);
    view.setUint32(20, 20000);
    expect(imageDimensions(bytes, 'png')).toEqual([20000, 20000]);
    expect(() => checkDimensions(...imageDimensions(bytes, 'png'))).toThrow();
    for (const dims of [
      [0, 10],
      [8193, 1],
      [6000, 6000],
      [NaN, 100],
    ])
      expect(() => checkDimensions(dims[0]!, dims[1]!)).toThrow();
  });
  it('bounds page canvases including extremely large page boxes', () => {
    for (const [w, h] of [
      [10000, 10000],
      [800, 2000],
      [1e9, 1e6],
    ]) {
      const [x, y] = canvasSize(w!, h!);
      expect(x * y).toBeLessThanOrEqual(4000000);
      expect(Math.max(x, y)).toBeLessThanOrEqual(3000);
    }
    expect(() => canvasSize(Infinity, 2)).toThrow();
  });
  it('does not trust tiny or broken embedded text', () => {
    expect(usableNativeText('tiny header')).toBe(false);
    expect(usableNativeText('A'.repeat(100) + '\uFFFD'.repeat(20))).toBe(false);
    expect(
      usableNativeText('Native invoice text with enough real characters to meet the rule.'),
    ).toBe(true);
  });
  it('rejects excessive combined text without truncation', () =>
    expect(() =>
      assertLocalText([{ text: 'a'.repeat(30000) }, { text: 'b'.repeat(20001) }]),
    ).toThrow());
  it('supports abort and deadlines', async () => {
    const c = new AbortController();
    const pending = timed(new Promise(() => undefined), 10000, c.signal);
    c.abort();
    await expect(pending).rejects.toThrow('canceled');
    vi.useFakeTimers();
    const timeout = timed(new Promise(() => undefined), 10);
    const check = expect(timeout).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(11);
    await check;
    vi.useRealTimers();
  });
});
