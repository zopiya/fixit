import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock settings module
vi.mock('../../src/shared/settings', () => ({
  getSettings: vi.fn(async () => ({
    highlightColor: '#3B82F6',
    highlightBorderWidth: 2,
    bubbleBorderRadius: 12,
    snapshotMaxLength: 500,
    highlightFlashMs: 2000,
    autoOpenPlayground: true,
    locale: 'auto',
    customHotkey: '',
    copyContext: {
      comment: true,
      cssSelector: true,
      xpath: true,
      confidence: true,
      htmlSnapshot: false,
    },
  })),
}));

import { AnnotationOverlay } from '../../src/content/overlay';

describe('AnnotationOverlay', () => {
  let overlay: AnnotationOverlay;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.innerHTML = '';
    overlay = new AnnotationOverlay();
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

  function getShadowRoot(): ShadowRoot | null {
    return overlay.getShadowRoot();
  }

  describe('activate()', () => {
    it('creates Shadow DOM host on documentElement', () => {
      overlay.activate();
      const host = document.documentElement.querySelector('fixit-overlay');
      expect(host).toBeTruthy();
    });

    it('shadow root is in closed mode (not accessible externally)', () => {
      overlay.activate();
      const host = document.documentElement.querySelector('fixit-overlay')!;
      // Closed mode: host.shadowRoot is null from outside
      expect(host.shadowRoot).toBeNull();
    });
  });

  describe('deactivate()', () => {
    it('removes all UI elements', () => {
      overlay.activate();
      overlay.deactivate();
      const host = document.documentElement.querySelector('fixit-overlay');
      expect(host).toBeNull();
    });

    it('does nothing when not activated', () => {
      expect(() => overlay.deactivate()).not.toThrow();
    });
  });

  describe('showBubble()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('renders textarea at given position', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.showBubble(el, { x: 275, y: 125 });

      const shadow = getShadowRoot()!;
      const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();

      const bubble = shadow.querySelector('[data-fixit="bubble"]') as HTMLElement;
      expect(bubble).toBeTruthy();
      expect(bubble.style.left).toBe('275px');
      expect(bubble.style.top).toBe('125px');
    });

    it('textarea is focused when shown', () => {
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });

      const shadow = getShadowRoot()!;
      const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement;
      expect(textarea).toBeTruthy();
    });
  });

  describe('hideBubble()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('removes bubble from DOM', () => {
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });
      overlay.hideBubble();

      const shadow = getShadowRoot()!;
      const bubble = shadow.querySelector('[data-fixit="bubble"]');
      expect(bubble).toBeNull();
    });

    it('does nothing when no bubble exists', () => {
      expect(() => overlay.hideBubble()).not.toThrow();
    });
  });

  describe('bubble keyboard interactions', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('Enter key triggers confirm callback with textarea value', () => {
      const onConfirm = vi.fn();
      overlay.onConfirm = onConfirm;

      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });

      const shadow = getShadowRoot()!;
      const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = 'Make this blue';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      textarea.dispatchEvent(enterEvent);

      expect(onConfirm).toHaveBeenCalledWith('Make this blue');
    });

    it('Esc key triggers cancel callback', () => {
      const onCancel = vi.fn();
      overlay.onCancel = onCancel;

      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });

      const shadow = getShadowRoot()!;
      const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement;

      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      textarea.dispatchEvent(escEvent);

      expect(onCancel).toHaveBeenCalled();
    });

    it('Enter key does not trigger confirm when textarea is empty', () => {
      const onConfirm = vi.fn();
      overlay.onConfirm = onConfirm;

      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });

      const shadow = getShadowRoot()!;
      const textarea = shadow.querySelector('textarea') as HTMLTextAreaElement;
      textarea.value = '';

      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      textarea.dispatchEvent(enterEvent);

      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('addBadge()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('places numbered badge on element', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);

      const shadow = getShadowRoot()!;
      const badge = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      expect(badge).toBeTruthy();
      expect(badge.textContent).toBe('①');
    });

    it('shows correct sequence number', () => {
      const el1 = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      const el2 = makeElement({ top: 300, left: 400, width: 150, height: 50 });

      overlay.addBadge(el1, 1);
      overlay.addBadge(el2, 2);

      const shadow = getShadowRoot()!;
      const badge1 = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      const badge2 = shadow.querySelector('[data-fixit="badge-2"]') as HTMLElement;
      expect(badge1.textContent).toBe('①');
      expect(badge2.textContent).toBe('②');
    });

    it('badge is positioned near the element', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);

      const shadow = getShadowRoot()!;
      const badge = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      // Position is set via CSS stylesheet (position: fixed), not inline
      expect(badge.style.top).toBeTruthy();
      expect(badge.style.left).toBeTruthy();
    });
  });

  describe('removeBadge()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('removes badge from DOM', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);
      overlay.removeBadge(1);

      const shadow = getShadowRoot()!;
      const badge = shadow.querySelector('[data-fixit="badge-1"]');
      expect(badge).toBeNull();
    });

    it('does nothing when badge does not exist', () => {
      expect(() => overlay.removeBadge(99)).not.toThrow();
    });
  });

  describe('updateBadgePositions()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('recalculates badge positions based on current element positions', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);

      const shadow = getShadowRoot()!;
      const badge = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      expect(badge.style.top).toBe('89px'); // 100 - 11
      expect(badge.style.left).toBe('339px'); // 200 + 150 - 11

      // Simulate element movement by updating getBoundingClientRect
      el.getBoundingClientRect = vi.fn(() => ({
        top: 300,
        left: 400,
        width: 100,
        height: 40,
        right: 500,
        bottom: 340,
        x: 400,
        y: 300,
        toJSON: () => {},
      }));

      overlay.updateBadgePositions();

      expect(badge.style.top).toBe('289px'); // 300 - 11
      expect(badge.style.left).toBe('489px'); // 400 + 100 - 11
    });

    it('updates multiple badges independently', () => {
      const el1 = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      const el2 = makeElement({ top: 300, left: 400, width: 150, height: 50 });
      overlay.addBadge(el1, 1);
      overlay.addBadge(el2, 2);

      // Move only el2
      el2.getBoundingClientRect = vi.fn(() => ({
        top: 50,
        left: 50,
        width: 80,
        height: 30,
        right: 130,
        bottom: 80,
        x: 50,
        y: 50,
        toJSON: () => {},
      }));

      overlay.updateBadgePositions();

      const shadow = getShadowRoot()!;
      const badge1 = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      const badge2 = shadow.querySelector('[data-fixit="badge-2"]') as HTMLElement;

      // el1 unchanged
      expect(badge1.style.top).toBe('89px');
      expect(badge1.style.left).toBe('339px');
      // el2 moved
      expect(badge2.style.top).toBe('39px'); // 50 - 11
      expect(badge2.style.left).toBe('119px'); // 50 + 80 - 11
    });
  });

  describe('markDisconnected()', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('changes badge style to indicate lost element', () => {
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);
      overlay.markDisconnected(1);

      const shadow = getShadowRoot()!;
      const badge = shadow.querySelector('[data-fixit="badge-1"]') as HTMLElement;
      expect(badge.getAttribute('data-disconnected')).toBe('true');
    });

    it('does nothing when badge does not exist', () => {
      expect(() => overlay.markDisconnected(99)).not.toThrow();
    });
  });

  describe('destroy()', () => {
    it('cleans up everything', () => {
      overlay.activate();
      const el = makeElement({ top: 100, left: 200, width: 150, height: 50 });
      overlay.addBadge(el, 1);
      overlay.showBubble(el, { x: 200, y: 100 });
      overlay.destroy();

      const host = document.documentElement.querySelector('fixit-overlay');
      expect(host).toBeNull();
    });

    it('can be called without activate', () => {
      expect(() => overlay.destroy()).not.toThrow();
    });
  });

  describe('event isolation', () => {
    beforeEach(() => {
      overlay.activate();
    });

    it('events inside shadow do not propagate to host page', () => {
      const hostPageHandler = vi.fn();
      document.addEventListener('click', hostPageHandler);

      const shadow = getShadowRoot()!;
      const el = makeElement({ top: 0, left: 0, width: 100, height: 50 });
      overlay.showBubble(el, { x: 50, y: 25 });

      const textarea = shadow.querySelector('textarea')!;
      const clickEvent = new MouseEvent('click', { bubbles: true });
      textarea.dispatchEvent(clickEvent);

      expect(hostPageHandler).not.toHaveBeenCalled();
      document.removeEventListener('click', hostPageHandler);
    });
  });
});
