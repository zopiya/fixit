import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
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

      const items = container.querySelectorAll('.annotation-item');
      expect(items).toHaveLength(2);
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

    it('shows confidence badge with correct color', () => {
      const renderer = new AnnotationRenderer(container);

      renderer.render([makeAnnotation({ cssSelectorConfidence: 'data-attr' })]);
      let badge = container.querySelector('.confidence-badge') as HTMLElement;
      expect(badge).toBeTruthy();
      expect(badge.dataset.confidence).toBe('data-attr');

      renderer.clear();
      renderer.render([makeAnnotation({ cssSelectorConfidence: 'structural' })]);
      badge = container.querySelector('.confidence-badge') as HTMLElement;
      expect(badge.dataset.confidence).toBe('structural');
    });

    it('shows empty state when annotations array is empty', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([]);

      expect(container.querySelector('.empty-state')).toBeTruthy();
      expect(container.textContent).toContain('No annotations');
    });
  });

  describe('clear()', () => {
    it('removes all rendered items', () => {
      const renderer = new AnnotationRenderer(container);
      renderer.render([makeAnnotation()]);
      expect(container.querySelectorAll('.annotation-item')).toHaveLength(1);

      renderer.clear();
      expect(container.querySelectorAll('.annotation-item')).toHaveLength(0);
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

      const item = container.querySelector('.annotation-item') as HTMLElement;
      item.click();

      expect(onHighlight).toHaveBeenCalledWith(ann);
    });
  });
});
