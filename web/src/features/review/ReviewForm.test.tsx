// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReviewForm } from './ReviewForm';
import { blankDocument } from '@invoice/shared';
afterEach(cleanup);
describe('accessible manual review', () => {
  it('allows manual values with no AI evidence', () => {
    const onEdit = vi.fn();
    render(
      <ReviewForm
        data={blankDocument()}
        provenance={{}}
        disabled={false}
        onEdit={onEdit}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText('Vendor name'), { target: { value: 'Manual shop' } });
    expect(onEdit).toHaveBeenCalledWith('/vendorName', 'Manual shop');
    fireEvent.focus(screen.getByLabelText('Vendor name'));
    expect(
      screen.getByText(/Manual entries and corrections do not require AI evidence/),
    ).toBeTruthy();
  });
  it('links format errors to editable controls', () => {
    render(
      <ReviewForm
        data={{ ...blankDocument(), total: 'bad' }}
        provenance={{}}
        disabled={false}
        onEdit={vi.fn()}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByLabelText('Total').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toContain('Correct invalid formats');
  });
});
