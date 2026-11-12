import {
  blankDocument,
  blankLine,
  blankTax,
  editValue,
  initialProvenance,
  removeRow,
  type DocumentData,
  type Evidence,
  type Provenance,
  type ReviewMeta,
  type TextPage,
} from '@invoice/shared';
import type { ProcessedPage } from '../features/documents/processor';
export type State = {
  pages: ProcessedPage[];
  data: DocumentData;
  provenance: Provenance;
  meta: ReviewMeta;
  initialDraft?: { data: DocumentData; evidence: Evidence[]; sourcePages: TextPage[] };
  reviewed: boolean;
  acknowledged: boolean;
  revision: number;
};
export const initialState = (): State => ({
  pages: [],
  data: blankDocument(),
  provenance: {},
  meta: { mode: 'manual', synthetic: false, textMethods: [], sourceTextEdited: false },
  reviewed: false,
  acknowledged: false,
  revision: 0,
});
type Action =
  | { type: 'reset' }
  | { type: 'document'; pages: ProcessedPage[]; synthetic: boolean }
  | { type: 'pages'; pages: ProcessedPage[] }
  | {
      type: 'draft';
      data: DocumentData;
      evidence?: Evidence[];
      mode: 'sample' | 'live-ai';
      model?: string;
      promptVersion?: string;
    }
  | { type: 'edit'; path: string; value: string | boolean | null }
  | { type: 'add'; group: 'lineItems' | 'taxes' }
  | { type: 'remove'; group: 'lineItems' | 'taxes'; index: number }
  | { type: 'text'; index: number; text: string }
  | { type: 'review'; value: boolean }
  | { type: 'acknowledge'; value: boolean }
  | { type: 'invalidate' };
const changed = (s: State) => ({
  ...s,
  reviewed: false,
  acknowledged: false,
  revision: s.revision + 1,
});
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initialState();
    case 'document':
      return {
        ...initialState(),
        pages: action.pages,
        meta: {
          mode: 'manual',
          synthetic: action.synthetic,
          textMethods: action.pages.map((p) => p.method),
          sourceTextEdited: false,
        },
      };
    case 'pages':
      return changed({
        ...state,
        pages: action.pages,
        meta: {
          ...state.meta,
          textMethods: action.pages.map((p) => p.method),
          sourceTextEdited: true,
        },
      });
    case 'draft':
      return changed({
        ...state,
        data: structuredClone(action.data),
        provenance: initialProvenance(
          action.data,
          action.mode === 'sample' ? 'sample' : 'ai',
          action.evidence,
        ),
        initialDraft: {
          data: structuredClone(action.data),
          evidence: action.evidence ?? [],
          sourcePages: state.pages.map((p) => ({ page: p.page, text: p.text })),
        },
        meta: {
          ...state.meta,
          mode: action.mode,
          model: action.model,
          promptVersion: action.promptVersion,
        },
      });
    case 'edit':
      return changed({
        ...state,
        ...editValue(state.data, state.provenance, action.path, action.value),
      });
    case 'add': {
      if (state.data[action.group].length >= (action.group === 'lineItems' ? 20 : 5)) return state;
      const data = structuredClone(state.data);
      if (action.group === 'lineItems') data.lineItems.push(blankLine());
      else data.taxes.push(blankTax());
      return changed({ ...state, data });
    }
    case 'remove':
      return changed({
        ...state,
        ...removeRow(state.data, state.provenance, action.group, action.index),
      });
    case 'text':
      return changed({
        ...state,
        pages: state.pages.map((p, i) =>
          i === action.index ? { ...p, text: action.text, method: 'manually edited text' } : p,
        ),
        meta: {
          ...state.meta,
          sourceTextEdited: true,
          textMethods: state.pages.map((p, i) =>
            i === action.index ? 'manually edited text' : p.method,
          ),
        },
      });
    case 'review':
      return { ...state, reviewed: action.value };
    case 'acknowledge':
      return { ...state, acknowledged: action.value };
    case 'invalidate':
      return changed(state);
  }
}
