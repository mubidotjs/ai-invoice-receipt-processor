// Test-only authored ground truth. Never imported by the application or Worker.
import expected from '../../fixtures/expected/documents.json' with { type: 'json' };
import { documentSchema, type Evidence, type TextPage } from '../../shared/src/schema';

export function authoredDraft(id: 'harbor' | 'saffron', extractedPages?: TextPage[]) {
  const fixture = expected.find((f) => f.id === id)!;
  const pages =
    extractedPages ?? fixture.text.map((lines, i) => ({ page: i + 1, text: lines.join('\n') }));
  const lines = pages.flatMap((page) =>
    page.text.split('\n').map((text) => ({ page: page.page, text: text.trim() })),
  );
  const quote = (path: string, prefix: string): Evidence => {
    const line = lines.find((l) => l.text.startsWith(prefix));
    if (!line) throw new Error('Authored supporting line missing from actual extraction.');
    return { path, page: line.page, quote: line.text };
  };
  const rowQuote = (i: number): Evidence => {
    const description = fixture.data.lineItems[i]!.description!;
    const page = pages.find((p) => p.text.includes(description));
    if (!page) throw new Error('Authored item missing from actual extraction.');
    const start = page.text.indexOf(description);
    const next = fixture.data.lineItems[i + 1]?.description ?? 'Line discounts:';
    const end = page.text.indexOf(next, start + description.length);
    if (end < 0) throw new Error('Authored item boundary missing from actual extraction.');
    // Sparse OCR may separate cells with newlines. Preserve the exact submitted
    // excerpt instead of pretending the ideal single-line transcription was OCR.
    return { path: `/lineItems/${i}`, page: page.page, quote: page.text.slice(start, end).trim() };
  };
  const evidence = [
    quote('/documentType', id === 'harbor' ? 'INVOICE ' : 'RECEIPT '),
    quote('/vendorName', fixture.data.vendorName),
    quote(
      id === 'harbor' ? '/invoiceNumber' : '/receiptNumber',
      id === 'harbor' ? 'INVOICE ' : 'RECEIPT ',
    ),
    quote('/issueDate', 'Issue date:'),
    quote('/currency', 'Currency:'),
    quote('/taxMode', 'Tax treatment:'),
    ...[0, 1].flatMap((i) => [
      rowQuote(i),
      quote(`/lineItems/${i}/discountAmount`, 'Line discounts:'),
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
        return quote(`/${field}`, labels[field]);
      },
    ),
  ];
  if (id === 'harbor') {
    evidence.push(quote('/dueDate', 'Due date:'));
    evidence.push(quote('/taxes/0', 'Sales tax'));
  }
  return { draft: { data: documentSchema.parse(structuredClone(fixture.data)), evidence }, pages };
}
