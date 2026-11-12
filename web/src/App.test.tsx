// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { blankDocument, MODEL, PROMPT_VERSION } from '@invoice/shared';
vi.mock('./features/extraction/client', () => ({
  aiAvailable: () => true,
  challenge: vi.fn(),
  extract: vi.fn(),
}));
import { challenge, extract } from './features/extraction/client';
import App from './App';
const mockResult = () => ({
  schemaVersion: '1' as const,
  mode: 'live-ai' as const,
  model: MODEL,
  promptVersion: PROMPT_VERSION,
  data: { ...blankDocument(), vendorName: 'HARBOR STUDIO', total: '165.00' },
  evidence: [
    { path: '/vendorName', page: 1, quote: 'HARBOR STUDIO' },
    { path: '/total', page: 1, quote: 'TOTAL USD 165.00' },
  ],
  checks: [],
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(challenge).mockResolvedValue('mock-token');
});
afterEach(cleanup);
function start() {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /Load sample result/ }));
}
function consentAndSubmit() {
  fireEvent.click(screen.getByRole('checkbox', { name: /I approve sending/ }));
  fireEvent.click(screen.getByRole('button', { name: /Extract with AI/ }));
}
describe('mocked consent, cloud failure and stale response flow', () => {
  it('never starts protection or inference without consent; applies mocked validated draft', async () => {
    start();
    expect(
      (screen.getByRole('button', { name: /Extract with AI/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(challenge).not.toHaveBeenCalled();
    vi.mocked(extract).mockResolvedValue(mockResult());
    consentAndSubmit();
    await waitFor(() => expect(screen.getByText('CLOUD AI DRAFT')).toBeTruthy());
    expect(challenge).toHaveBeenCalledTimes(1);
    expect(extract).toHaveBeenCalledTimes(1);
    expect(
      (screen.getByRole('checkbox', { name: /I approve sending/ }) as HTMLInputElement).checked,
    ).toBe(false);
    fireEvent.change(screen.getByLabelText('Total', { exact: true }), {
      target: { value: '160.00' },
    });
    fireEvent.focus(screen.getByLabelText('Total', { exact: true }));
    expect(
      screen.getByText(/Manual entries and corrections do not require AI evidence/),
    ).toBeTruthy();
  });
  it.each(['Cloud AI is disabled', 'Shared quota exhausted', 'AI output failed validation'])(
    'preserves manual-only review and export after %s',
    async (failure) => {
      start();
      fireEvent.change(screen.getByLabelText('Vendor name'), {
        target: { value: 'Manual vendor' },
      });
      vi.mocked(extract).mockRejectedValue(new Error(failure));
      consentAndSubmit();
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(failure));
      expect((screen.getByLabelText('Vendor name') as HTMLInputElement).value).toBe(
        'Manual vendor',
      );
      fireEvent.click(screen.getByRole('checkbox', { name: /I reviewed this revision/ }));
      const ack = screen.queryByRole('checkbox', { name: /I acknowledge/ });
      if (ack) fireEvent.click(ack);
      expect(
        (screen.getByRole('button', { name: /Download JSON/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
      expect(
        (screen.getByRole('button', { name: /Download CSV/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
    },
  );
  it('does not apply a late AI result after manual editing', async () => {
    let resolve!: (value: ReturnType<typeof mockResult>) => void;
    vi.mocked(extract).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    start();
    consentAndSubmit();
    await waitFor(() => expect(extract).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Vendor name'), {
      target: { value: 'Keep this manual correction' },
    });
    await act(async () => resolve(mockResult()));
    expect((screen.getByLabelText('Vendor name') as HTMLInputElement).value).toBe(
      'Keep this manual correction',
    );
    expect(screen.queryByText('CLOUD AI DRAFT')).toBeNull();
  });
  it('does not send text when mocked protection rejects the attempt', async () => {
    start();
    vi.mocked(challenge).mockRejectedValue(new Error('Verification failed'));
    consentAndSubmit();
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('Verification failed'),
    );
    expect(extract).not.toHaveBeenCalled();
  });
});
