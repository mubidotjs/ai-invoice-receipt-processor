import { useState } from 'react';
import { documentSchema, type DocumentData, type Provenance } from '@invoice/shared';
type Props = {
  data: DocumentData;
  provenance: Provenance;
  disabled: boolean;
  onEdit: (path: string, value: string | boolean | null) => void;
  onAdd: (group: 'lineItems' | 'taxes') => void;
  onRemove: (group: 'lineItems' | 'taxes', index: number) => void;
};
const titles: Record<string, string> = {
  documentType: 'Document type',
  vendorName: 'Vendor name',
  invoiceNumber: 'Invoice number',
  receiptNumber: 'Receipt number',
  issueDate: 'Issue date',
  dueDate: 'Due date',
  currency: 'Currency',
  taxMode: 'Tax treatment',
  subtotal: 'Subtotal',
  taxTotal: 'Tax total',
  discountTotal: 'Document discount',
  shipping: 'Shipping',
  tip: 'Tip',
  total: 'Total',
  description: 'Description',
  quantity: 'Quantity',
  unitPrice: 'Unit price',
  discountAmount: 'Line discount',
  lineTotal: 'Line total',
  label: 'Tax label',
  ratePercent: 'Tax rate (%)',
  amount: 'Tax amount',
};
const choices: Record<string, string[]> = {
  documentType: ['unknown', 'invoice', 'receipt'],
  currency: ['', 'USD', 'EUR', 'GBP', 'PKR'],
  taxMode: ['unknown', 'exclusive', 'inclusive'],
};
export function ReviewForm({ data, provenance, disabled, onEdit, onAdd, onRemove }: Props) {
  const [focusPath, setFocusPath] = useState<string>();
  const result = documentSchema.safeParse(data);
  const errors = result.success
    ? new Map<string, string>()
    : new Map(result.error.issues.map((i) => ['/' + i.path.join('/'), i.message]));
  function field(key: string, value: string | null, prefix = '', suffix = '') {
    const path = `${prefix}/${key}`;
    const id = `field${path.replaceAll('/', '-')}`;
    const label = `${titles[key] ?? key}${suffix}`;
    const p = provenance[path];
    const error = errors.get(path);
    return (
      <div className={`field ${key === 'description' ? 'wide' : ''}`} key={path}>
        <label htmlFor={id}>{titles[key] ?? key}</label>
        {choices[key] ? (
          <select
            id={id}
            aria-label={label}
            value={value ?? ''}
            onFocus={() => setFocusPath(path)}
            onChange={(e) => onEdit(path, e.target.value || null)}
          >
            {choices[key].map((v) => (
              <option key={v} value={v}>
                {v === '' ? 'Not identified' : v === 'unknown' ? 'Not confirmed' : v}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            aria-label={label}
            value={value ?? ''}
            placeholder={
              /Date$/.test(key)
                ? 'YYYY-MM-DD'
                : /(?:total|amount|shipping|tip|discount)/i.test(key)
                  ? 'Not reported · e.g. 12.50'
                  : 'Not reported'
            }
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onFocus={() => setFocusPath(path)}
            onChange={(e) => onEdit(path, e.target.value === '' ? null : e.target.value)}
          />
        )}
        <span className="field-origin">{p ? p.origin.replaceAll('-', ' ') : 'manual entry'}</span>
        {error ? (
          <span id={`${id}-error`} className="field-error">
            {error}
          </span>
        ) : null}
      </div>
    );
  }
  const focused = focusPath ? provenance[focusPath] : undefined;
  return (
    <fieldset disabled={disabled} className="review-fields">
      <legend className="sr-only">Review document data</legend>
      {!result.success ? (
        <div className="error-summary" role="alert">
          <strong>Correct invalid formats before exporting.</strong>
          <ul>
            {result.error.issues.map((i, n) => (
              <li key={n}>
                <a href={`#field-${i.path.join('-')}`}>
                  {i.path.join(' › ')}: {i.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="form-grid">
        {(
          [
            'documentType',
            'vendorName',
            'invoiceNumber',
            'receiptNumber',
            'issueDate',
            'dueDate',
            'currency',
            'taxMode',
          ] as const
        ).map((k) => field(k, data[k]))}
      </div>
      <div className="evidence-panel" aria-live="polite">
        <span className="eyebrow">Field provenance</span>
        {focused?.origin === 'ai' ? (
          <>
            <p>AI value supported by submitted text. Compare with the preview.</p>
            {focused.evidence?.map((e, i) => (
              <blockquote key={i}>
                Page {e.page}: “{e.quote}”
              </blockquote>
            ))}
          </>
        ) : (
          <p>
            {focused?.origin === 'sample'
              ? 'Deterministic synthetic sample value. No live AI evidence is claimed.'
              : 'Manual entries and corrections do not require AI evidence. Original extracted evidence is kept separately during this session.'}
          </p>
        )}
      </div>
      <div className="section-line">
        <h3>
          Line items <span className="count">{data.lineItems.length}/20</span>
        </h3>
        <button
          type="button"
          onClick={() => onAdd('lineItems')}
          disabled={data.lineItems.length >= 20}
        >
          + Add item
        </button>
      </div>
      {data.lineItems.length ? (
        data.lineItems.map((line, i) => (
          <section className="line-card" key={i} aria-label={`Line item ${i + 1}`}>
            <div className="section-line">
              <strong>Item {String(i + 1).padStart(2, '0')}</strong>
              <button
                className="text-button"
                type="button"
                aria-label={`Remove item ${i + 1}`}
                onClick={() => onRemove('lineItems', i)}
              >
                Remove
              </button>
            </div>
            <div className="form-grid">
              {Object.entries(line).map(([k, v]) => field(k, v, `/lineItems/${i}`, ` ${i + 1}`))}
            </div>
          </section>
        ))
      ) : (
        <p className="muted">
          No line items entered. Add items or acknowledge incomplete coverage.
        </p>
      )}
      <label className="check-label">
        <input
          type="checkbox"
          checked={data.lineItemsComplete}
          onChange={(e) => onEdit('/lineItemsComplete', e.target.checked)}
        />{' '}
        I checked that all document line items are included.
      </label>
      <div className="section-line">
        <h3>
          Taxes <span className="count">{data.taxes.length}/5</span>
        </h3>
        <button type="button" onClick={() => onAdd('taxes')} disabled={data.taxes.length >= 5}>
          + Add tax
        </button>
      </div>
      {data.taxes.map((tax, i) => (
        <section className="line-card" key={i}>
          <div className="section-line">
            <strong>Tax {i + 1}</strong>
            <button
              className="text-button"
              type="button"
              aria-label={`Remove tax ${i + 1}`}
              onClick={() => onRemove('taxes', i)}
            >
              Remove
            </button>
          </div>
          <div className="form-grid">
            {Object.entries(tax).map(([k, v]) => field(k, v, `/taxes/${i}`, ` ${i + 1}`))}
          </div>
        </section>
      ))}
      <h3>Amounts & adjustments</h3>
      <p className="muted small">
        Use decimal points. Leave unreported amounts blank. Unit prices and line totals must use the
        selected tax basis.
      </p>
      <div className="form-grid">
        {(['subtotal', 'taxTotal', 'discountTotal', 'shipping', 'tip', 'total'] as const).map((k) =>
          field(k, data[k]),
        )}
      </div>
    </fieldset>
  );
}
