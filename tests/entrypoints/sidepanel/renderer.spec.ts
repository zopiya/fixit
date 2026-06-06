import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
import { setLocale } from '../../../src/shared/i18n';
import { AnnotationRenderer } from '../../../entrypoints/sidepanel/renderer';

function makeAnnotation(overrides: Partial<FixItAnnotation> = {}): FixItAnnotation {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    url: 'http://localhost:3000/dashboard',
    fullUrl: 'http://localhost:3000/dashboard',
    cssSelector: '[data-testid="submit-btn"]',
    cssSelectorConfidence: 'data-attr',
    xpath: '//button[@data-testid="submit-btn"]',
    htmlSnapshot: '<button data-testid="submit-btn">Submit</button>',
    userComment: 'Change color to blue',
    sequenceIndex: 1,
    createdAt: Date.now(),
    ...overrides,
  };
}

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  setLocale('en');
});

describe('AnnotationRenderer', () => {
  describe('render()', () => {
    it('creates list items for each annotation', () => {
      const renderer = new AnnotationRenderer(container);
      const annotations = [
        makeAnnotation({ id: 'a1', sequenceIndex: 1 }),
        makeAnnotation({ id: 'a2', sequenceIndex: 2 }),
      ];
      renderer.render(annotations);

      const items = container.querySelectorAll('[data-testid="annotation-item"]');
      expect(items).toHaveLength(2);
    });

    it('marks stale annotations whose element is missing', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.setStaleIds(new Set(['a2']));
      renderer.render([
        makeAnnotation({ id: 'a1', sequenceIndex: 1 }),
        makeAnnotation({ id: 'a2', sequenceIndex: 2 }),
      ]);

      const items = container.querySelectorAll('[data-testid="annotation-item"]');
      expect(items[0].getAttribute('data-stale')).toBeNull();
      expect(items[1].getAttribute('data-stale')).toBe('true');
      expect(container.querySelectorAll('[data-testid="stale-tag"]')).toHaveLength(1);
    });

    it('shows circled sequence number for each annotation', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation({ sequenceIndex: 1 })]);

      expect(container.textContent).toContain('①');
    });

    it('shows user comment text', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation({ userComment: 'Make it bigger' })]);

      expect(container.textContent).toContain('Make it bigger');
    });

    it('shows confidence dot with correct level', () => {
      const renderer = new AnnotationRenderer(container);

      renderer.render([makeAnnotation({ cssSelectorConfidence: 'data-attr' })]);
      let dot = container.querySelector('[data-testid="confidence-dot"]') as HTMLElement;
      expect(dot).toBeTruthy();
      expect(dot.dataset.level).toBe('high');

      renderer.clear();
      renderer.render([makeAnnotation({ cssSelectorConfidence: 'structural' })]);
      dot = container.querySelector('[data-testid="confidence-dot"]') as HTMLElement;
      expect(dot.dataset.level).toBe('low');
    });

    it('shows empty state when annotations array is empty', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([]);

      expect(container.querySelector('[data-testid="empty-state"]')).toBeTruthy();
      expect(container.textContent).toContain('No annotations');
    });
  });

  describe('clear()', () => {
    it('removes all rendered items', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation()]);
      expect(container.querySelectorAll('[data-testid="annotation-item"]')).toHaveLength(1);

      renderer.clear();
      expect(container.querySelectorAll('[data-testid="annotation-item"]')).toHaveLength(0);
    });
  });

  describe('destroy()', () => {
    it('removes all content and event listeners', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation()]);
      renderer.destroy();

      expect(container.children).toHaveLength(0);
    });
  });

  describe('click interaction', () => {
    it('invokes onHighlight callback when annotation item is clicked', () => {
      const renderer = new AnnotationRenderer(container);
      const onHighlight = vi.fn();
      renderer.onHighlight = onHighlight;

      const ann = makeAnnotation({ id: 'click-me' });
      renderer.render([ann]);

      const item = container.querySelector('[data-testid="annotation-item"]') as HTMLElement;
      item.click();

      expect(onHighlight).toHaveBeenCalledWith(ann);
    });

    it('invokes onDelete callback when × button is clicked', () => {
      const renderer = new AnnotationRenderer(container);
      const onDelete = vi.fn();
      renderer.onDelete = onDelete;

      const ann = makeAnnotation({ id: 'delete-target' });
      renderer.render([ann]);

      // The × button is the last child of the annotation item
      const item = container.querySelector('[data-testid="annotation-item"]') as HTMLElement;
      const deleteBtn = item.querySelector('button') as HTMLButtonElement;
      deleteBtn.click();

      expect(onDelete).toHaveBeenCalledWith(ann);
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('delete button does not trigger onHighlight callback', () => {
      const renderer = new AnnotationRenderer(container);
      const onHighlight = vi.fn();
      const onDelete = vi.fn();
      renderer.onHighlight = onHighlight;
      renderer.onDelete = onDelete;

      const ann = makeAnnotation({ id: 'no-highlight' });
      renderer.render([ann]);

      const item = container.querySelector('[data-testid="annotation-item"]') as HTMLElement;
      const deleteBtn = item.querySelector('button') as HTMLButtonElement;
      deleteBtn.click();

      expect(onDelete).toHaveBeenCalled();
      expect(onHighlight).not.toHaveBeenCalled();
    });
  });

  describe('high sequence index', () => {
    it('renders fallback for sequenceIndex > 20', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation({ sequenceIndex: 21 })]);

      expect(container.textContent).toContain('(21)');
    });

    it('renders circled number for sequenceIndex <= 20', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation({ sequenceIndex: 20 })]);

      expect(container.textContent).toContain('⑳');
    });
  });
});
