import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Highlighter } from '../../src/content/highlighter';

describe('Highlighter', () => {
  let host: HTMLElement;
  let shadow: ShadowRoot;
  let highlighter: Highlighter;

  beforeEach(() => {
    document.body.innerHTML = '';
    host = document.createElement('div');
    shadow = host.attachShadow({ mode: 'open' });
    document.body.appendChild(host);
    highlighter = new Highlighter(shadow);
  });

  function makeElement(rect: { top: number; left: number; width: number; height: number }) {
    const el = document.createElement('div');
    document.body.appendChild(el);
    el.getBoundingClientRect = vi.fn(() => ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => {},
    }));
    return el;
  }

  describe('show()', () => {
    it('positions overlay on element bounding rect', () => {
      const el = makeElement({ top: 50, left: 100, width: 200, height: 80 });
      highlighter.show(el);

      const overlay = shadow.querySelector('[data-fixit="highlight"]') as HTMLElement;
      expect(overlay).toBeTruthy();
      expect(overlay.style.top).toBe('50px');
      expect(overlay.style.left).toBe('100px');
      expect(overlay.style.width).toBe('200px');
      expect(overlay.style.height).toBe('80px');
    });

    it('applies brand color border style', () => {
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      highlighter.show(el);

      const overlay = shadow.querySelector('[data-fixit="highlight"]') as HTMLElement;
      expect(overlay.style.border).toBe('2px solid #3B82F6');
    });

    it('only one overlay exists after multiple show() calls', () => {
      const el1 = makeElement({ top: 10, left: 10, width: 100, height: 50 });
      const el2 = makeElement({ top: 200, left: 300, width: 150, height: 75 });

      highlighter.show(el1);
      highlighter.show(el2);

      const overlays = shadow.querySelectorAll('[data-fixit="highlight"]');
      expect(overlays).toHaveLength(1);
    });

    it('moves overlay to new element position on subsequent show()', () => {
      const el1 = makeElement({ top: 10, left: 10, width: 100, height: 50 });
      const el2 = makeElement({ top: 200, left: 300, width: 150, height: 75 });

      highlighter.show(el1);
      highlighter.show(el2);

      const overlay = shadow.querySelector('[data-fixit="highlight"]') as HTMLElement;
      expect(overlay.style.top).toBe('200px');
      expect(overlay.style.left).toBe('300px');
      expect(overlay.style.width).toBe('150px');
      expect(overlay.style.height).toBe('75px');
    });

    it('overlay dimensions match element dimensions', () => {
      const el = makeElement({ top: 0, left: 0, width: 345, height: 123 });
      highlighter.show(el);

      const overlay = shadow.querySelector('[data-fixit="highlight"]') as HTMLElement;
      expect(overlay.style.width).toBe('345px');
      expect(overlay.style.height).toBe('123px');
    });
  });

  describe('hide()', () => {
    it('removes overlay visual', () => {
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      highlighter.show(el);
      highlighter.hide();

      const overlay = shadow.querySelector('[data-fixit="highlight"]');
      expect(overlay).toBeNull();
    });

    it('does nothing when no overlay exists', () => {
      expect(() => highlighter.hide()).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('cleans up all DOM', () => {
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      highlighter.show(el);
      highlighter.destroy();

      const overlay = shadow.querySelector('[data-fixit="highlight"]');
      expect(overlay).toBeNull();
    });

    it('can be called multiple times safely', () => {
      expect(() => {
        highlighter.destroy();
        highlighter.destroy();
      }).not.toThrow();
    });
  });
});
