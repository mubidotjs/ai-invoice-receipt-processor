import { LIMITS, normalizeText } from '@invoice/shared';
import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
import type { Worker as OCRWorker } from 'tesseract.js';

export type ProcessedPage = {
  page: number;
  text: string;
  method: 'PDF text' | 'OCR' | 'manually edited text' | 'Bundled sample text';
  preview: string;
  width: number;
  height: number;
};
export function identifyFile(
  name: string,
  mime: string,
  bytes: Uint8Array,
): 'png' | 'jpeg' | 'pdf' {
  const ext = name.split('.').at(-1)?.toLowerCase();
  let kind: 'png' | 'jpeg' | 'pdf' | undefined;
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) kind = 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) kind = 'jpeg';
  if (new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-') kind = 'pdf';
  const extensions = { png: ['png'], jpeg: ['jpg', 'jpeg'], pdf: ['pdf'] };
  const types = { png: 'image/png', jpeg: 'image/jpeg', pdf: 'application/pdf' };
  if (!kind || !extensions[kind].includes(ext ?? '') || (mime !== '' && mime !== types[kind]))
    throw new Error('Choose a genuine PNG, JPEG or PDF with its matching file extension.');
  return kind;
}
export function checkDimensions(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > LIMITS.imageEdge ||
    height > LIMITS.imageEdge ||
    width * height > LIMITS.imagePixels
  )
    throw new Error(
      'Image exceeds 20 megapixels or 8,192 pixels on an edge. Resize it before uploading.',
    );
}
export function imageDimensions(bytes: Uint8Array, kind: 'png' | 'jpeg'): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (kind === 'png' && bytes.length >= 24) return [view.getUint32(16), view.getUint32(20)];
  let i = 2;
  while (i + 8 < bytes.length) {
    if (bytes[i] !== 255) break;
    const marker = bytes[i + 1]!;
    i += 2;
    if (marker === 217 || marker === 218) break;
    if (marker === 216 || marker === 1 || (marker >= 208 && marker <= 215)) continue;
    const size = view.getUint16(i);
    if (size < 2 || i + size > bytes.length) break;
    if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker))
      return [view.getUint16(i + 5), view.getUint16(i + 3)];
    i += size;
  }
  throw new Error('Image header is invalid or unsupported.');
}
export function canvasSize(width: number, height: number): [number, number] {
  if (!Number.isFinite(width + height) || width <= 0 || height <= 0)
    throw new Error('Invalid page dimensions.');
  const scale = Math.min(
    1,
    LIMITS.canvasEdge / width,
    LIMITS.canvasEdge / height,
    Math.sqrt(LIMITS.canvasPixels / (width * height)),
  );
  return [Math.max(1, Math.floor(width * scale)), Math.max(1, Math.floor(height * scale))];
}
export function usableNativeText(text: string) {
  const chars = [...text].filter((c) => !/\s/u.test(c));
  return chars.length >= 40 && chars.filter((c) => c === '\uFFFD').length / chars.length <= 0.02;
}
export function assertLocalText(pages: { text: string }[]) {
  if (pages.reduce((sum, p) => sum + p.text.length, 0) > LIMITS.localChars)
    throw new Error('Extracted text exceeds 50,000 characters. Use a smaller document.');
}
export async function timed<T>(promise: Promise<T>, ms: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error('Processing timed out. Try a smaller document or continue manually.')),
          ms,
        );
        abort = () => reject(new Error('Processing canceled.'));
        if (signal?.aborted) abort();
        else signal?.addEventListener('abort', abort, { once: true });
      }),
    ]);
  } finally {
    clearTimeout(timer);
    if (abort) signal?.removeEventListener('abort', abort);
  }
}
export class DocumentProcessor {
  private pdf?: PDFDocumentProxy;
  private loading?: PDFDocumentLoadingTask;
  private ocr?: Promise<OCRWorker>;
  private canvases: HTMLCanvasElement[] = [];
  private urls = new Set<string>();
  private disposed = false;
  constructor(private notify: (message: string) => void) {}
  private active() {
    if (this.disposed) throw new Error('Processing canceled.');
  }
  dispose() {
    this.disposed = true;
    void this.loading?.destroy().catch(() => undefined);
    this.loading = undefined;
    this.pdf = undefined;
    void this.ocr?.then((w) => w.terminate()).catch(() => undefined);
    this.ocr = undefined;
    this.canvases.forEach((c) => {
      c.width = 0;
      c.height = 0;
    });
    this.canvases = [];
    this.urls.forEach((url) => URL.revokeObjectURL(url));
    this.urls.clear();
  }
  private async recognize(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<string> {
    this.active();
    const started = Date.now();
    if (!this.ocr)
      this.ocr = import('tesseract.js').then(async ({ createWorker, PSM }) => {
        const w = await createWorker('eng', 1, {
          workerPath: '/assets/ocr/worker.min.js',
          corePath: '/assets/ocr/core',
          langPath: '/assets/ocr/lang',
          workerBlobURL: false,
          cacheMethod: 'none',
          gzip: true,
          logger: (m) => {
            if (!this.disposed) this.notify(`${m.status} · ${Math.round(m.progress * 100)}%`);
          },
        });
        if (this.disposed) {
          void w.terminate();
          throw new Error('Processing canceled.');
        }
        // Sparse documents have separated vendor headings, amounts and table cells.
        try {
          await w.setParameters({
            tessedit_pageseg_mode: PSM.SPARSE_TEXT,
            preserve_interword_spaces: '1',
          });
          return w;
        } catch (error) {
          void w.terminate();
          throw error;
        }
      });
    const worker = await timed(this.ocr, LIMITS.ocrMs, signal);
    this.active();
    const result = await timed(
      worker.recognize(canvas),
      Math.max(1, LIMITS.ocrMs - (Date.now() - started)),
      signal,
    );
    this.active();
    return normalizeText(result.data.text);
  }
  private async preview(canvas: HTMLCanvasElement): Promise<string> {
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (v) => (v ? resolve(v) : reject(new Error('Could not create document preview.'))),
        'image/png',
      ),
    );
    this.active();
    const url = URL.createObjectURL(blob);
    this.urls.add(url);
    return url;
  }
  async process(file: File, signal: AbortSignal): Promise<ProcessedPage[]> {
    try {
      return await timed(this.processInner(file, signal), LIMITS.localMs, signal);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  private async processInner(file: File, signal: AbortSignal): Promise<ProcessedPage[]> {
    if (!file.size || file.size > LIMITS.fileBytes)
      throw new Error('Choose one nonempty file no larger than 10 MiB.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.active();
    const kind = identifyFile(file.name, file.type, bytes);
    const pages: ProcessedPage[] = [];
    if (kind === 'pdf') {
      this.notify('Opening PDF locally…');
      const pdfjs = await import('pdfjs-dist');
      this.active();
      pdfjs.GlobalWorkerOptions.workerSrc = '/assets/pdf/pdf.worker.min.mjs';
      this.loading = pdfjs.getDocument({
        data: bytes,
        cMapUrl: '/assets/pdf/cmaps/',
        cMapPacked: true,
        standardFontDataUrl: '/assets/pdf/standard_fonts/',
        iccUrl: '/assets/pdf/iccs/',
        wasmUrl: '/assets/pdf/wasm/',
        useWorkerFetch: false,
        stopAtErrors: true,
        enableXfa: false,
        maxImageSize: LIMITS.imagePixels,
        canvasMaxAreaInBytes: LIMITS.canvasPixels * 4,
      });
      this.loading.onPassword = () => {
        void this.loading?.destroy();
      };
      try {
        this.pdf = await timed(this.loading.promise, LIMITS.pdfMs, signal);
      } catch {
        throw new Error('Cannot open this PDF. It may be encrypted, corrupt or too complex.');
      }
      this.active();
      if (this.pdf.numPages > LIMITS.pages)
        throw new Error(
          'PDFs may contain at most three pages of one document. No pages were processed.',
        );
      for (let pageNo = 1; pageNo <= this.pdf.numPages; pageNo++) {
        this.active();
        this.notify(`Reading PDF page ${pageNo} of ${this.pdf.numPages}…`);
        const page = await this.pdf.getPage(pageNo);
        this.active();
        const base = page.getViewport({ scale: 2 });
        const [width, height] = canvasSize(base.width, base.height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.canvases.push(canvas);
        const viewport = page.getViewport({ scale: (2 * width) / base.width });
        await timed(
          page.render({ canvas, viewport, background: '#ffffff' }).promise,
          LIMITS.localMs,
          signal,
        );
        this.active();
        const content = await page.getTextContent();
        this.active();
        let lastY: number | undefined;
        let text = '';
        for (const item of content.items)
          if ('str' in item) {
            const y = item.transform[5] as number;
            if (lastY !== undefined) text += Math.abs(y - lastY) > 3 ? '\n' : ' ';
            text += item.str;
            if (item.hasEOL) text += '\n';
            lastY = y;
            if (text.length > LIMITS.localChars)
              throw new Error('Extracted text exceeds 50,000 characters.');
          }
        text = normalizeText(text).trim();
        const native = usableNativeText(text);
        if (!native) text = await this.recognize(canvas, signal);
        pages.push({
          page: pageNo,
          text,
          method: native ? 'PDF text' : 'OCR',
          preview: await this.preview(canvas),
          width,
          height,
        });
        assertLocalText(pages);
        page.cleanup();
      }
    } else {
      checkDimensions(...imageDimensions(bytes, kind));
      this.notify('Decoding image locally…');
      const bitmap = await timed(
        createImageBitmap(file, { imageOrientation: 'from-image' }).then((b) => {
          if (this.disposed) {
            b.close();
            throw new Error('Processing canceled.');
          }
          return b;
        }),
        LIMITS.decodeMs,
        signal,
      );
      try {
        this.active();
        checkDimensions(bitmap.width, bitmap.height);
        const [width, height] = canvasSize(bitmap.width, bitmap.height);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        this.canvases.push(canvas);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas is unavailable in this browser.');
        context.fillStyle = '#fff';
        context.fillRect(0, 0, width, height);
        context.drawImage(bitmap, 0, 0, width, height);
        pages.push({
          page: 1,
          text: await this.recognize(canvas, signal),
          method: 'OCR',
          preview: await this.preview(canvas),
          width,
          height,
        });
      } finally {
        bitmap.close();
      }
    }
    assertLocalText(pages);
    return pages;
  }
  async rerun(
    pages: ProcessedPage[],
    index: number,
    rotate: boolean,
    signal: AbortSignal,
  ): Promise<ProcessedPage[]> {
    try {
      return await timed(
        (async () => {
          this.active();
          let canvas = this.canvases[index];
          if (!canvas) throw new Error('Process the document before rerunning OCR.');
          if (rotate) {
            const rotated = document.createElement('canvas');
            rotated.width = canvas.height;
            rotated.height = canvas.width;
            const ctx = rotated.getContext('2d');
            if (!ctx) throw new Error('Canvas is unavailable.');
            ctx.translate(rotated.width, 0);
            ctx.rotate(Math.PI / 2);
            ctx.drawImage(canvas, 0, 0);
            canvas.width = 0;
            canvas.height = 0;
            canvas = rotated;
            this.canvases[index] = canvas;
          }
          const text = await this.recognize(canvas, signal);
          this.active();
          const next = pages.map((p, i) =>
            i === index
              ? {
                  ...p,
                  text,
                  method: 'OCR' as const,
                  preview: '',
                  width: canvas.width,
                  height: canvas.height,
                }
              : p,
          );
          assertLocalText(next);
          next[index]!.preview = await this.preview(canvas);
          const old = pages[index]!.preview;
          URL.revokeObjectURL(old);
          this.urls.delete(old);
          return next;
        })(),
        LIMITS.localMs,
        signal,
      );
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
}
