import { describe, expect, it } from 'vitest';
import { initialState, reducer } from './state';
import { blankDocument } from '@invoice/shared';
describe('review revision lifecycle', () => {
  it('resets review and warning acknowledgment on every edit and row change', () => {
    let s = { ...initialState(), reviewed: true, acknowledged: true };
    s = reducer(s, { type: 'edit', path: '/vendorName', value: 'Manual vendor' });
    expect(s.reviewed).toBe(false);
    expect(s.acknowledged).toBe(false);
    expect(s.provenance['/vendorName']?.origin).toBe('manual-entry');
    s = reducer({ ...s, reviewed: true }, { type: 'add', group: 'lineItems' });
    expect(s.reviewed).toBe(false);
    expect(s.data.lineItems).toHaveLength(1);
    s = reducer(s, { type: 'remove', group: 'lineItems', index: 0 });
    expect(s.data.lineItems).toHaveLength(0);
  });
  it('retains initial AI evidence separately after a manual correction', () => {
    const data = { ...blankDocument(), total: '10.00' };
    const evidence = [{ path: '/total', page: 1, quote: 'Total 10.00' }];
    let s = reducer(initialState(), { type: 'draft', data, evidence, mode: 'live-ai' });
    s = reducer(s, { type: 'edit', path: '/total', value: '12.00' });
    expect(s.initialDraft?.data.total).toBe('10.00');
    expect(s.initialDraft?.evidence).toEqual(evidence);
    expect(s.provenance['/total']?.evidence).toBeUndefined();
  });
  it('source edits reset review and identify the edited method', () => {
    let s = reducer(initialState(), {
      type: 'document',
      synthetic: true,
      pages: [
        { page: 1, text: 'Original', method: 'OCR', preview: 'blob:preview', width: 1, height: 1 },
      ],
    });
    s = reducer(
      { ...s, reviewed: true, acknowledged: true },
      { type: 'text', index: 0, text: 'Corrected' },
    );
    expect(s.meta.sourceTextEdited).toBe(true);
    expect(s.pages[0]?.method).toBe('manually edited text');
    expect(s.reviewed).toBe(false);
    expect(reducer(s, { type: 'reset' })).toEqual(initialState());
  });
});
