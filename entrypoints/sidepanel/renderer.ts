import type { FixItAnnotation } from '../../src/shared/types';
import { circledNumber } from '../../src/shared/utils';
import { t } from '../../src/shared/i18n';

const CONFIDENCE_LEVEL: Record<string, string> = {
  'data-attr': 'high',
  'id': 'high',
  'aria': 'high',
  'name': 'high',
  'semantic-class': 'mid',
  'structural': 'low',
};

export class AnnotationRenderer {
  private container: HTMLElement;
  private staleIds: Set<string> = new Set();
  onHighlight: ((annotation: FixItAnnotation) => void) | null = null;
  onDelete: ((annotation: FixItAnnotation) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  /** Mark annotations whose element can't currently be found on the page. */
  setStaleIds(ids: Set<string>): void {
    this.staleIds = ids;
  }

  render(annotations: FixItAnnotation[]): void {
    this.container.innerHTML = '';

    if (annotations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'flex flex-col items-center justify-center h-full text-slate-400 text-sm text-center p-10 gap-2';
      empty.dataset.testid = 'empty-state';
      empty.innerHTML = `<div class="text-3xl opacity-40 mb-2">📌</div><div>${t('sidepanel.empty')}</div>`;
      this.container.appendChild(empty);
      return;
    }

    const sorted = [...annotations].sort((a, b) => a.sequenceIndex - b.sequenceIndex);
    for (const ann of sorted) {
      this.container.appendChild(this.createItem(ann));
    }
  }

  clear(): void {
    this.container.innerHTML = '';
  }

  destroy(): void {
    this.onHighlight = null;
    this.onDelete = null;
    this.container.innerHTML = '';
  }

  private createItem(ann: FixItAnnotation): HTMLElement {
    const isStale = this.staleIds.has(ann.id);
    const item = document.createElement('div');
    item.className = 'px-3 py-3 rounded-xl cursor-pointer transition-all hover:bg-slate-50 group';
    item.dataset.testid = 'annotation-item';
    if (isStale) {
      item.dataset.stale = 'true';
      item.classList.add('opacity-60');
      item.title = t('annotation.stale');
    }

    const row = document.createElement('div');
    row.className = 'flex items-start gap-3';

    const seq = document.createElement('div');
    seq.className = 'w-7 h-7 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5';
    seq.textContent = circledNumber(ann.sequenceIndex);

    const body = document.createElement('div');
    body.className = 'flex-1 min-w-0';

    const comment = document.createElement('div');
    comment.className = 'text-sm font-medium text-slate-800 leading-snug';
    comment.textContent = ann.userComment || t('annotation.untitled');

    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 mt-1.5';

    const dot = document.createElement('div');
    dot.className = 'w-1.5 h-1.5 rounded-full shrink-0';
    dot.dataset.testid = 'confidence-dot';
    const level = CONFIDENCE_LEVEL[ann.cssSelectorConfidence] ?? 'low';
    dot.dataset.level = level;
    if (level === 'high') dot.classList.add('bg-emerald-500');
    else if (level === 'mid') dot.classList.add('bg-yellow-500');
    else dot.classList.add('bg-red-500');

    const selector = document.createElement('span');
    selector.className = 'text-xs text-slate-400 font-mono truncate max-w-48';
    selector.textContent = ann.cssSelector;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'w-6 h-6 rounded-full border-none bg-transparent text-slate-300 cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shrink-0 hover:bg-red-50 hover:text-red-500 self-center';
    deleteBtn.textContent = '×';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onDelete?.(ann);
    });

    meta.appendChild(dot);
    meta.appendChild(selector);

    if (isStale) {
      const staleTag = document.createElement('span');
      staleTag.className = 'text-xs text-amber-500 font-medium shrink-0';
      staleTag.dataset.testid = 'stale-tag';
      staleTag.textContent = '⚠';
      staleTag.title = t('annotation.stale');
      meta.appendChild(staleTag);
    }
    body.appendChild(comment);
    body.appendChild(meta);
    row.appendChild(seq);
    row.appendChild(body);
    row.appendChild(deleteBtn);
    item.appendChild(row);

    item.addEventListener('click', () => this.onHighlight?.(ann));
    return item;
  }
}
