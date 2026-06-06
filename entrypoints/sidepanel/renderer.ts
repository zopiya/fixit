import type { FixItAnnotation } from '../../src/shared/types';

const CIRCLED_NUMBERS = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                         '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

function circledNumber(n: number): string {
  return CIRCLED_NUMBERS[n - 1] ?? `(${n})`;
}

const CONFIDENCE_COLORS: Record<string, string> = {
  'data-attr': '#22c55e',
  'id': '#22c55e',
  'aria': '#22c55e',
  'name': '#22c55e',
  'semantic-class': '#eab308',
  'structural': '#ef4444',
};

const CONFIDENCE_LABELS: Record<string, string> = {
  'data-attr': 'data-attr',
  'id': 'id',
  'aria': 'aria',
  'name': 'name',
  'semantic-class': 'class',
  'structural': 'structural',
};

export class AnnotationRenderer {
  private container: HTMLElement;
  onHighlight: ((annotation: FixItAnnotation) => void) | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  render(annotations: FixItAnnotation[]): void {
    this.container.innerHTML = '';

    if (annotations.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'No annotations yet. Activate FixIt and click an element to annotate.';
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
    this.container.innerHTML = '';
  }

  private createItem(ann: FixItAnnotation): HTMLElement {
    const item = document.createElement('div');
    item.className = 'annotation-item';

    const header = document.createElement('div');
    header.className = 'annotation-header';

    const seq = document.createElement('span');
    seq.className = 'annotation-sequence';
    seq.textContent = circledNumber(ann.sequenceIndex);

    const comment = document.createElement('span');
    comment.className = 'annotation-comment';
    comment.textContent = ann.userComment || 'Untitled';

    const badge = document.createElement('span');
    badge.className = 'confidence-badge';
    badge.dataset.confidence = ann.cssSelectorConfidence;
    badge.textContent = CONFIDENCE_LABELS[ann.cssSelectorConfidence] ?? ann.cssSelectorConfidence;
    badge.style.backgroundColor = CONFIDENCE_COLORS[ann.cssSelectorConfidence] ?? '#6b7280';

    header.appendChild(seq);
    header.appendChild(comment);
    header.appendChild(badge);

    const selector = document.createElement('div');
    selector.className = 'annotation-selector';
    selector.textContent = ann.cssSelector;

    item.appendChild(header);
    item.appendChild(selector);

    item.addEventListener('click', () => {
      this.onHighlight?.(ann);
    });

    return item;
  }
}
