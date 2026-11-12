import { describe, expect, it } from 'vitest';
import expected from '../../fixtures/expected/documents.json';
import { validateAIOutput } from './evidence';
import { blankDocument, type Evidence } from './schema';
import { OutputValidationError, safeOutputPath } from './diagnostics';
import { validateDocument } from './validation';

function authoredDraft(id: 'harbor' | 'saffron') {
  const fixture = expected.find((f) => f.id === id)!;
  const quote = (path: string, text: string): Evidence => ({ path, page: 1, quote: text });
  const evidence = [
    quote('/documentType', fixture.text[0]![1]!),
    quote('/vendorName', fixture.text[0]![0]!),
    quote(id === 'harbor' ? '/invoiceNumber' : '/receiptNumber', fixture.text[0]![1]!),
    quote('/issueDate', 'Issue date: 2026-10-28'),
    quote('/currency', `Currency: ${fixture.data.currency}`),
    quote('/taxMode', 'Tax treatment: exclusive'),
    ...[0, 1].flatMap((i) => [
      quote(
        `/lineItems/${i}`,
        fixture.text[0]!.find((line) => line.startsWith(fixture.data.lineItems[i]!.description!))!,
      ),
      quote(`/lineItems/${i}/discountAmount`, 'Line discounts: 0.00'),
    ]),
    ...(['subtotal', 'taxTotal', 'discountTotal', 'shipping', 'tip', 'total'] as const).map(
      (field) => {
        const labels = {
          subtotal: 'Subtotal:',
          taxTotal: 'Tax total:',
          discountTotal: 'Document discount:',
          shipping: 'Shipping:',
          tip: 'Tip:',
          total: 'TOTAL ',
        };
        return quote(`/${field}`, fixture.text[0]!.find((line) => line.startsWith(labels[field]))!);
      },
    ),
  ];
  if (id === 'harbor') {
    evidence.push(quote('/dueDate', 'Due date: 2026-11-27'));
    evidence.push(quote('/taxes/0', 'Sales tax 10%: 15.00'));
  }
  return {
    draft: { data: structuredClone(fixture.data), evidence },
    pages: fixture.text.map((lines, i) => ({ page: i + 1, text: lines.join('\n') })),
  };
}

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
