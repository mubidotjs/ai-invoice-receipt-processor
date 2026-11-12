import { useEffect, useReducer, useRef, useState } from 'react';
import {
  LIMITS,
  csvExport,
  documentSchema,
  exportRecord,
  jsonExport,
  normalizeText,
  validateDocument,
  type DocumentData,
  type ValidationCheck,
} from '@invoice/shared';
import { reducer, initialState } from './app/state';
import { DocumentProcessor, type ProcessedPage } from './features/documents/processor';
import { aiAvailable, challenge, extract } from './features/extraction/client';
import { download } from './features/export/download';
import { ReviewForm } from './features/review/ReviewForm';
import samplesJson from '../../fixtures/demo/samples.json';
type Sample = {
  id: string;
  title: string;
  description: string;
  file: string;
  mime: string;
  pages: { text: string; preview: string }[];
  data: DocumentData;
};
const samples = samplesJson as Sample[];
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Processing failed. Try a supported smaller document or continue manually.';
export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const [sampleId, setSampleId] = useState(samples[0]!.id);
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState<'document' | 'ai' | null>(null);
  const [status, setStatus] = useState('Ready for a document. Your files stay in this browser.');
  const [error, setError] = useState('');
  const [consent, setConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const processor = useRef<DocumentProcessor | null>(null);
  const abort = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const challengeHost = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      epoch.current++;
      abort.current?.abort();
      processor.current?.dispose();
    },
    [],
  );
  useEffect(() => {
    if (!busy) return;
    const start = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  const sample = samples.find((s) => s.id === sampleId)!;
  const currentPage = state.pages[pageIndex];
  const schema = documentSchema.safeParse(state.data);
  const checks = validateDocument(state.data);
  const additional: ValidationCheck[] =
    state.meta.sourceTextEdited && state.meta.mode === 'live-ai'
      ? [
          {
            code: 'SOURCE_TEXT_CHANGED',
            path: '/',
            status: 'warning',
            message:
              'Source text has changed. AI evidence refers to the original submitted text revision; compare the current values with the preview.',
          },
        ]
      : [];
  const findings = [...checks, ...additional];
  const unresolved = findings.filter((c) => c.status !== 'pass');
  const chars = state.pages.reduce((n, p) => n + p.text.length, 0);
  const canExport =
    schema.success && state.reviewed && (!unresolved.length || state.acknowledged) && !busy;
  function invalidate() {
    epoch.current++;
    abort.current?.abort();
    abort.current = null;
    setConsent(false);
    if (busy === 'ai') setBusy(null);
  }
  function edit(path: string, value: string | boolean | null) {
    invalidate();
    dispatch({ type: 'edit', path, value });
  }
  function reset() {
    invalidate();
    processor.current?.dispose();
    processor.current = null;
    dispatch({ type: 'reset' });
    setPageIndex(0);
    setBusy(null);
    setError('');
    setStatus('Session cleared. Document references and previews were released.');
    if (fileInput.current) fileInput.current.value = '';
  }
  async function processFile(file: File, synthetic: boolean) {
    invalidate();
    processor.current?.dispose();
    dispatch({ type: 'reset' });
    setPageIndex(0);
    setError('');
    setElapsed(0);
    setBusy('document');
    const id = epoch.current;
    const controller = new AbortController();
    abort.current = controller;
    const service: DocumentProcessor = new DocumentProcessor((text) => {
      if (processor.current === service) setStatus(text);
    });
    processor.current = service;
    try {
      const pages = await service.process(file, controller.signal);
      if (id !== epoch.current) return;
      dispatch({ type: 'document', pages, synthetic });
      setStatus(
        'Local extraction complete. Review the text, then enter values manually or explicitly request AI.',
      );
    } catch (e) {
      if (id === epoch.current) {
        setError(message(e));
        setStatus('Document processing stopped. No sample values were substituted.');
      }
    } finally {
      if (id === epoch.current) {
        setBusy(null);
        abort.current = null;
      }
    }
  }
  async function sampleDocument() {
    invalidate();
    const id = epoch.current;
    setError('');
    try {
      const res = await fetch('/samples/documents/' + sample.file);
      if (!res.ok) throw new Error('Bundled sample could not load. Run npm run assets.');
      const blob = await res.blob();
      if (id !== epoch.current) return;
      await processFile(new File([blob], sample.file, { type: sample.mime }), true);
    } catch (e) {
      if (id === epoch.current) setError(message(e));
    }
  }
  function sampleResult() {
    invalidate();
    processor.current?.dispose();
    processor.current = null;
    setBusy(null);
    setError('');
    setPageIndex(0);
    const pages: ProcessedPage[] = sample.pages.map((p, i) => ({
      page: i + 1,
      text: p.text,
      preview: '/samples/documents/' + p.preview,
      method: 'Bundled sample text',
      width: 900,
      height: 1200,
    }));
    dispatch({ type: 'document', pages, synthetic: true });
    dispatch({ type: 'draft', data: sample.data, mode: 'sample' });
    setStatus(
      'Deterministic sample loaded. No OCR or AI ran. You can correct and export these synthetic values.',
    );
  }
  async function rerun(rotate: boolean) {
    if (!processor.current) return;
    invalidate();
    const id = epoch.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy('document');
    setStatus(rotate ? 'Rotating this page and running OCR…' : 'Running OCR on this page…');
    setElapsed(0);
    setError('');
    try {
      const pages = await processor.current.rerun(
        state.pages,
        pageIndex,
        rotate,
        controller.signal,
      );
      if (id !== epoch.current) return;
      dispatch({ type: 'pages', pages });
      setStatus('OCR replaced this page’s text. Review and consent were reset.');
    } catch (e) {
      if (id === epoch.current) {
        setError(message(e));
        processor.current = null;
      }
    } finally {
      if (id === epoch.current) {
        setBusy(null);
        abort.current = null;
      }
    }
  }
  async function runAI() {
    if (!consent || !aiAvailable() || !challengeHost.current) return;
    const textPages = state.pages.map((p) => ({ page: p.page, text: normalizeText(p.text) }));
    invalidate();
    dispatch({ type: 'invalidate' });
    const id = epoch.current;
    const controller = new AbortController();
    abort.current = controller;
    setBusy('ai');
    setElapsed(0);
    setError('');
    setStatus('Completing bot verification before sending the approved text…');
    try {
      const token = await challenge(challengeHost.current, controller.signal);
      if (id !== epoch.current) return;
      setStatus('Sending approved text to Cloudflare for one AI attempt…');
      const result = await extract(textPages, token, controller.signal);
      if (id !== epoch.current) return;
      dispatch({
        type: 'draft',
        data: result.data,
        evidence: result.evidence,
        mode: 'live-ai',
        model: result.model,
        promptVersion: result.promptVersion,
      });
      setStatus(
        'Cloud AI draft received and source-checked. Every financial value still needs review.',
      );
    } catch (e) {
      if (id === epoch.current) {
        setError(message(e));
        setStatus('No AI draft was applied. Continue manually with the existing values.');
      }
    } finally {
      if (id === epoch.current) {
        setBusy(null);
        abort.current = null;
      }
    }
  }
  function exportFile(kind: 'json' | 'csv') {
    try {
      const record = exportRecord(
        state.data,
        state.provenance,
        state.meta,
        state.reviewed,
        state.acknowledged,
        additional,
      );
      download(kind === 'json' ? jsonExport(record) : csvExport(record), kind);
      setError('');
      setStatus(`Corrected ${kind.toUpperCase()} exported locally.`);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to document workspace
      </a>
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            L<span>·</span>
          </span>
          <span>
            Ledger<span className="brand-light">Lens</span>
          </span>
        </a>
        <div className="header-meta">
          <span className="status-dot" /> Browser-first document processing{' '}
          <span className="version">MVP / 01</span>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <p className="eyebrow">AI INVOICE & RECEIPT PROCESSOR</p>
            <h1>
              From paperwork
              <br />
              to <em>clear, reviewed data.</em>
            </h1>
            <p className="intro-copy">
              Read documents locally. Review every number.
              <br />
              Export a record you understand.
            </p>
          </div>
          <aside className="privacy-note">
            <span className="shield" aria-hidden="true">
              ↳
            </span>
            <strong>Your document stays here.</strong>
            <p>
              OCR runs in your browser. Optional AI sends only the text you approve to Cloudflare.
              No document history is stored.
            </p>
            <a href="#privacy">How processing works ↓</a>
          </aside>
        </section>
        <div className="workflow-strip" aria-label="Processing workflow">
          <span>
            <b>01</b> Add document
          </span>
          <span>
            <b>02</b> Extract locally
          </span>
          <span>
            <b>03</b> Review & correct
          </span>
          <span>
            <b>04</b> Export
          </span>
        </div>
        <section className="intake" aria-labelledby="intake-title">
          <div className="upload-area">
            <div className="section-line">
              <h2 id="intake-title">Start with a document</h2>
              <span className="pill neutral">LOCAL PROCESSING</span>
            </div>
            <label className="upload-box" htmlFor="document-upload">
              <span className="upload-symbol" aria-hidden="true">
                ↑
              </span>
              <strong>Choose an invoice or receipt</strong>
              <span>PNG, JPG or PDF · up to 10 MiB · 3 PDF pages</span>
              <input
                ref={fileInput}
                id="document-upload"
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                disabled={!!busy}
                onChange={(e) => {
                  const files = e.target.files;
                  if (files?.length === 1) void processFile(files[0]!, false);
                  else if (files?.length) setError('Process one document at a time.');
                }}
              />
            </label>
          </div>
          <div className="sample-area">
            <p className="eyebrow">NO DOCUMENT? TRY A SYNTHETIC EXAMPLE</p>
            <label htmlFor="sample-select" className="sr-only">
              Synthetic example
            </label>
            <select
              id="sample-select"
              value={sampleId}
              disabled={!!busy}
              onChange={(e) => setSampleId(e.target.value)}
            >
              {samples.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <p className="muted small">{sample.description}</p>
            <div className="button-row">
              <button disabled={!!busy} onClick={() => void sampleDocument()}>
                Process sample document
              </button>
              <button className="text-button" disabled={!!busy} onClick={sampleResult}>
                Load sample result ↗
              </button>
            </div>
            <p className="small muted">
              Processing runs real local extraction. Sample results are deterministic; no AI runs.
            </p>
          </div>
        </section>
        <div className={`session-status ${busy ? 'working' : ''}`} role="status" aria-live="polite">
          <span className="status-dot" />
          <span>
            {status}
            {busy ? ` (${elapsed}s)` : ''}
          </span>
          <div className="status-actions">
            {busy ? (
              <button
                onClick={() => {
                  invalidate();
                  if (busy === 'document') {
                    processor.current?.dispose();
                    processor.current = null;
                  }
                  setBusy(null);
                  setStatus(
                    'Canceled. Existing structured values remain available for manual review.',
                  );
                }}
              >
                Cancel processing
              </button>
            ) : null}
            <button className="text-button" onClick={reset}>
              Clear session
            </button>
          </div>
        </div>
        {error ? (
          <div className="error-summary" role="alert">
            <strong>Action needed</strong>
            <p>{error}</p>
          </div>
        ) : null}
        <div className="workspace" id="workspace">
          <section className="panel source-panel" aria-labelledby="source-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">SOURCE DOCUMENT</p>
                <h2 id="source-title">Preview & extracted text</h2>
              </div>
              {state.meta.synthetic ? (
                <span className="pill amber">SYNTHETIC</span>
              ) : (
                <span className="pill neutral">LOCAL</span>
              )}
            </div>
            {currentPage ? (
              <>
                <div className="page-toolbar">
                  <button
                    aria-label="Previous page"
                    disabled={pageIndex === 0 || !!busy}
                    onClick={() => setPageIndex((i) => i - 1)}
                  >
                    ←
                  </button>
                  <span>
                    Page {pageIndex + 1} / {state.pages.length}
                  </span>
                  <button
                    aria-label="Next page"
                    disabled={pageIndex >= state.pages.length - 1 || !!busy}
                    onClick={() => setPageIndex((i) => i + 1)}
                  >
                    →
                  </button>
                  <span className="method-label">{currentPage.method}</span>
                </div>
                <div
                  className="document-preview"
                  tabIndex={0}
                  role="region"
                  aria-label="Scrollable document preview"
                >
                  <img src={currentPage.preview} alt={`Document preview, page ${pageIndex + 1}`} />
                </div>
                <div className="button-row source-tools">
                  <button disabled={!!busy || !processor.current} onClick={() => void rerun(false)}>
                    Run OCR on this page
                  </button>
                  <button disabled={!!busy || !processor.current} onClick={() => void rerun(true)}>
                    Rotate 90° & OCR
                  </button>
                </div>
                <label htmlFor="source-text" className="text-label">
                  {state.meta.mode === 'sample' ? 'Bundled synthetic text' : 'Extracted text'}{' '}
                  <span>{chars.toLocaleString()} characters</span>
                </label>
                <textarea
                  id="source-text"
                  className="source-text"
                  spellCheck={false}
                  value={currentPage.text}
                  disabled={busy === 'document'}
                  onChange={(e) => {
                    if (
                      state.pages.reduce(
                        (n, p, i) => n + (i === pageIndex ? e.target.value.length : p.text.length),
                        0,
                      ) > LIMITS.localChars
                    ) {
                      setError('Text may not exceed 50,000 characters.');
                      return;
                    }
                    invalidate();
                    dispatch({
                      type: 'text',
                      index: pageIndex,
                      text: normalizeText(e.target.value),
                    });
                  }}
                />
                <p className="small muted">
                  Text may contain OCR errors or incomplete PDF coverage. Compare it with every
                  page. Editing resets consent and review.
                </p>
              </>
            ) : (
              <div className="empty-preview">
                <span aria-hidden="true">▤</span>
                <strong>A little less paperwork.</strong>
                <p>Your document preview and locally extracted text will appear here.</p>
              </div>
            )}
            <section className="ai-section" aria-labelledby="ai-title">
              <div className="section-line">
                <h3 id="ai-title">Optional AI extraction</h3>
                <span className="pill neutral">
                  {aiAvailable() ? 'CLOUD · OPT IN' : 'DISABLED LOCALLY'}
                </span>
              </div>
              <p className="small">
                AI sees only the exact page text displayed above. Cloudflare processes it in the
                cloud; this is not on-device AI. Raw documents are never sent.
              </p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={consent}
                  disabled={!aiAvailable() || !state.pages.length || !!busy}
                  onChange={(e) => setConsent(e.target.checked)}
                />{' '}
                I approve sending this displayed text to Cloudflare for this extraction attempt.
              </label>
              <button
                className="primary"
                disabled={!aiAvailable() || !consent || !chars || chars > LIMITS.aiChars || !!busy}
                onClick={() => void runAI()}
              >
                Extract with AI <span aria-hidden="true">↗</span>
              </button>
              <div ref={challengeHost} />
              <p className="small muted">
                {chars > LIMITS.aiChars
                  ? 'Text exceeds the 12,000-character AI limit. Edit it explicitly or continue manually.'
                  : 'One attempt. No paid fallback. Editing a value cancels pending AI. Text already sent cannot be retracted.'}
              </p>
            </section>
          </section>
          <section className="panel review-panel" aria-labelledby="review-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">STRUCTURED RECORD</p>
                <h2 id="review-title">Review & correct</h2>
              </div>
              <span className={`pill ${state.meta.mode === 'sample' ? 'amber' : 'neutral'}`}>
                {state.meta.mode === 'sample'
                  ? 'SAMPLE RESULT'
                  : state.meta.mode === 'live-ai'
                    ? 'CLOUD AI DRAFT'
                    : 'MANUAL ENTRY'}
              </span>
            </div>
            <p className="panel-description">
              Every amount needs your review. Blank fields mean unreported or uncertain; they are
              never assumed correct.
            </p>
            <ReviewForm
              data={state.data}
              provenance={state.provenance}
              disabled={busy === 'document'}
              onEdit={edit}
              onAdd={(group) => {
                invalidate();
                dispatch({ type: 'add', group });
              }}
              onRemove={(group, index) => {
                invalidate();
                dispatch({ type: 'remove', group, index });
              }}
            />
            <section className="checks" aria-labelledby="checks-title">
              <div className="section-line">
                <h3 id="checks-title">Validation & consistency</h3>
                <span className="count">{unresolved.length} to review</span>
              </div>
              <p className="small muted">
                Arithmetic consistency is conditional, not proof of financial correctness.
              </p>
              <ul className="check-list">
                {findings.map((c, i) => (
                  <li key={`${c.code}-${i}`} className={c.status}>
                    <span className="check-icon" aria-hidden="true">
                      {c.status === 'pass' ? '✓' : '!'}
                    </span>
                    <div>
                      <strong>{c.code.replaceAll('_', ' ')}</strong>
                      <p>{c.message}</p>
                      {c.expected ? (
                        <p>
                          Expected {c.expected} · observed {c.observed} · difference {c.difference}
                        </p>
                      ) : null}
                      {c.assumptions?.map((a) => (
                        <p className="small" key={a}>
                          Assumption: {a}
                        </p>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
            <section className="export-panel" aria-labelledby="export-title">
              <p className="eyebrow">FINAL CHECK</p>
              <h3 id="export-title">Reviewed by you. Exported locally.</h3>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={state.reviewed}
                  disabled={!!busy}
                  onChange={(e) => dispatch({ type: 'review', value: e.target.checked })}
                />{' '}
                I reviewed this revision against the document, including identifiers, dates,
                currency and financial values.
              </label>
              {unresolved.length ? (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={state.acknowledged}
                    disabled={!!busy}
                    onChange={(e) => dispatch({ type: 'acknowledge', value: e.target.checked })}
                  />{' '}
                  I acknowledge the {unresolved.length} unresolved warnings or unavailable checks.
                  Include them in my export.
                </label>
              ) : null}
              <div className="button-row">
                <button
                  className="primary"
                  disabled={!canExport}
                  onClick={() => exportFile('json')}
                >
                  Download JSON ↓
                </button>
                <button disabled={!canExport} onClick={() => exportFile('csv')}>
                  Download CSV ↓
                </button>
              </div>
              <p className="small muted">
                {!schema.success
                  ? 'Correct invalid formats before export.'
                  : 'Manual-only and incomplete records can be exported after review and warning acknowledgment.'}
              </p>
            </section>
          </section>
        </div>
        <section className="privacy-footer" id="privacy">
          <div>
            <p className="eyebrow">BUILT WITH CLEAR BOUNDARIES</p>
            <h2>Local first. Human reviewed.</h2>
          </div>
          <div>
            <h3>In your browser</h3>
            <p>
              PDF text extraction, OCR, previews, corrections, validation and downloads. No database
              or saved history. Clearing the session releases document references.
            </p>
          </div>
          <div>
            <h3>Only with your consent</h3>
            <p>
              Approved text goes to Cloudflare for optional AI extraction. Cloud inference and bot
              verification use external services. Provider metadata and policy exceptions may apply.
            </p>
            <a
              href="https://developers.cloudflare.com/workers-ai/platform/data-usage/"
              target="_blank"
              rel="noreferrer"
            >
              Cloudflare data policy ↗
            </a>
          </div>
        </section>
      </main>
      <footer className="footer">
        <span>
          Ledger Lens <span className="muted">/ AI Engineering Portfolio</span>
        </span>
        <span>English · USD / EUR / GBP / PKR</span>
      </footer>
    </>
  );
}
