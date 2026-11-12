import { describe, expect, it } from 'vitest';
import { authoredDraft } from '../../tests/helpers/authored-evidence';
import { validateAIOutput } from './evidence';
import { blankDocument } from './schema';
import { OutputValidationError, safeOutputPath } from './diagnostics';
import { validateDocument } from './validation';

describe('authored invoice/receipt output feasibility (deterministic; no provider)', () => {
  it.each(['harbor', 'saffron'] as const)('accepts every supported field/row in %s', (id) => {
    const { draft, pages } = authoredDraft(id);
    expect(validateAIOutput(draft, pages).data).toEqual(draft.data);
    expect(
      validateDocument(validateAIOutput(draft, pages).data).filter((c) => c.status === 'warning'),
    ).toEqual([]);
  });
  it('accepts both independently supported named dates in one source excerpt', () => {
    const text = 'Issue 28 October 2026; due 27 November 2026';
    const draft = {
      data: { ...blankDocument(), issueDate: '2026-10-28', dueDate: '2026-11-27' },
      evidence: [
        { path: '/issueDate', page: 1, quote: text },
        { path: '/dueDate', page: 1, quote: text },
      ],
    };
    expect(validateAIOutput(draft, [{ page: 1, text }]).data.dueDate).toBe('2026-11-27');
  });
  it.each(['harbor', 'saffron'] as const)('rejects missing classification evidence in %s', (id) => {
    const { draft, pages } = authoredDraft(id);
    draft.evidence = draft.evidence.filter((e) => e.path !== '/documentType');
    expect(() => validateAIOutput(draft, pages)).toThrowError(
      new OutputValidationError({
        stage: 'evidence',
        code: 'missing_evidence',
        path: '/data/documentType',
      }),
    );
    try {
      validateAIOutput(draft, pages);
    } catch (e) {
      expect((e as OutputValidationError).diagnostic).toEqual({
        stage: 'evidence',
        code: 'missing_evidence',
        path: '/data/documentType',
      });
    }
  });
  it('rejects the diagnostic /data prefix as a model evidence pointer', () => {
    const { draft, pages } = authoredDraft('harbor');
    draft.evidence[0]!.path = '/data/documentType';
    try {
      validateAIOutput(draft, pages);
      throw new Error('Expected rejection');
    } catch (e) {
      expect((e as OutputValidationError).diagnostic).toEqual({
        stage: 'evidence',
        code: 'invalid_evidence_path',
        path: '/evidence/0/path',
      });
    }
  });
  it.each(['harbor', 'saffron'] as const)(
    'rejects the wrong supported classification in %s',
    (id) => {
      const { draft, pages } = authoredDraft(id);
      draft.data.documentType = id === 'harbor' ? 'receipt' : 'invoice';
      try {
        validateAIOutput(draft, pages);
        throw new Error('Expected rejection');
      } catch (e) {
        expect((e as OutputValidationError).diagnostic).toEqual({
          stage: 'value',
          code: 'unsupported_value',
          path: '/data/documentType',
        });
      }
    },
  );
  it.each(['harbor', 'saffron'] as const)('requires separate tax-mode evidence in %s', (id) => {
    const { draft, pages } = authoredDraft(id);
    draft.evidence = draft.evidence.filter((e) => e.path !== '/taxMode');
    try {
      validateAIOutput(draft, pages);
      throw new Error('Expected rejection');
    } catch (e) {
      expect((e as OutputValidationError).diagnostic).toEqual({
        stage: 'evidence',
        code: 'missing_evidence',
        path: '/data/taxMode',
      });
    }
  });
  it('does not let one header excerpt cover a different populated header', () => {
    const { draft, pages } = authoredDraft('harbor');
    draft.evidence = draft.evidence.filter((e) => e.path !== '/dueDate');
    try {
      validateAIOutput(draft, pages);
      throw new Error('Expected rejection');
    } catch (e) {
      expect((e as OutputValidationError).diagnostic).toEqual({
        stage: 'evidence',
        code: 'missing_evidence',
        path: '/data/dueDate',
      });
    }
  });
  it('accepts mixed direct-field and row evidence; rejects an uncovered row value', () => {
    const { draft, pages } = authoredDraft('harbor');
    const row = draft.evidence.find((e) => e.path === '/lineItems/0')!;
    draft.evidence = draft.evidence.filter((e) => e !== row);
    for (const field of ['description', 'quantity', 'unitPrice', 'lineTotal'])
      draft.evidence.push({ ...row, path: `/lineItems/0/${field}` });
    expect(validateAIOutput(draft, pages).data).toEqual(draft.data);
    draft.evidence = draft.evidence.filter((e) => e.path !== '/lineItems/0/unitPrice');
    try {
      validateAIOutput(draft, pages);
      throw new Error('Expected rejection');
    } catch (e) {
      expect((e as OutputValidationError).diagnostic).toEqual({
        stage: 'evidence',
        code: 'missing_evidence',
        path: '/data/lineItems/0/unitPrice',
      });
    }
  });
  it('preserves null, unknown enum and boolean evidence exemptions', () => {
    const data = blankDocument();
    expect(
      validateAIOutput({ data, evidence: [] }, [
        { page: 1, text: 'Unclassified synthetic document' },
      ]).data,
    ).toEqual(data);
  });
  it.each([
    ['path', '/private-value'],
    ['page', 2],
    ['quote', 'not in the source'],
  ] as const)('rejects invalid evidence %s with content-free diagnostics', (field, value) => {
    const { draft, pages } = authoredDraft('harbor');
    Object.assign(draft.evidence[0]!, { [field]: value });
    try {
      validateAIOutput(draft, pages);
      throw new Error('Expected rejection');
    } catch (error) {
      expect(error).toBeInstanceOf(OutputValidationError);
      expect((error as OutputValidationError).diagnostic).toMatchObject({
        stage: 'evidence',
        code: `invalid_evidence_${field}`,
      });
      expect(JSON.stringify((error as OutputValidationError).diagnostic)).not.toContain(
        String(value),
      );
    }
  });
  it('rejects unsupported amounts and missing row discounts; does not invent zeros', () => {
    const { draft, pages } = authoredDraft('saffron');
    draft.data.total = '681.00';
    expect(() => validateAIOutput(draft, pages)).toThrow(OutputValidationError);
    draft.data.total = '680.00';
    draft.evidence = draft.evidence.filter((e) => e.path !== '/lineItems/0/discountAmount');
    expect(() => validateAIOutput(draft, pages)).toThrow(OutputValidationError);
  });
  it('never exposes arbitrary property keys as diagnostic paths', () => {
    expect(safeOutputPath(['data', 'private-financial-value'])).toBeUndefined();
    expect(safeOutputPath(['data', 'lineItems', 999, 'description'])).toBeUndefined();
    expect(safeOutputPath(['data', 'lineItems', 1, 'quantity'])).toBe('/data/lineItems/1/quantity');
  });
  it('rejects an ISO date embedded in a longer numeric date token', () => {
    const text = 'Issue 2026-10-280';
    expect(() =>
      validateAIOutput(
        {
          data: { ...blankDocument(), issueDate: '2026-10-28' },
          evidence: [{ path: '/issueDate', page: 1, quote: text }],
        },
        [{ page: 1, text }],
      ),
    ).toThrow(OutputValidationError);
  });
});
