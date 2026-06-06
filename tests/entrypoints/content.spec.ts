import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome APIs
const messageListeners: ((msg: unknown) => void)[] = [];
const chromeMock = {
  runtime: {
    onMessage: {
      addListener: vi.fn((fn: (msg: unknown) => void) => {
        messageListeners.push(fn);
      }),
    },
    sendMessage: vi.fn(),
  },
};
vi.stubGlobal('chrome', chromeMock);
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid') });

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
  })),
}));

// Mock locator functions
vi.mock('../../src/content/locator/index', () => ({
  generateCssSelector: vi.fn(() => ({ selector: '#test', confidence: 'id' })),
  generateXPath: vi.fn(() => ({ xpath: "id('test')/div", isRelative: true })),
}));

// Mock Highlighter — instance methods track calls to shared vi.fn()
const mockShow = vi.fn();
const mockHide = vi.fn();
const mockDestroy = vi.fn();
vi.mock('../../src/content/highlighter', () => ({
  Highlighter: class MockHighlighter {
    show = mockShow;
    hide = mockHide;
    destroy = mockDestroy;
  },
}));

// Mock AnnotationOverlay — activate creates a real host element so highlighter can be created
const mockShowBubble = vi.fn();
const mockHideBubble = vi.fn();
const mockAddBadge = vi.fn();
const mockRemoveBadge = vi.fn();
const mockMarkDisconnected = vi.fn();
const mockOverlayDestroy = vi.fn();
const mockGetShadowRoot = vi.fn();
let confirmCallback: ((comment: string) => void) | null = null;
let cancelCallback: (() => void) | null = null;

const mockActivate = vi.fn(() => {
  const host = document.createElement('fixit-overlay');
  const shadow = host.attachShadow({ mode: 'closed' });
  document.documentElement.appendChild(host);
  mockGetShadowRoot.mockReturnValue(shadow);
});

const mockDeactivate = vi.fn(() => {
  const host = document.documentElement.querySelector('fixit-overlay');
  if (host) host.remove();
  mockGetShadowRoot.mockReturnValue(null);
});

vi.mock('../../src/content/overlay', () => ({
  AnnotationOverlay: class MockAnnotationOverlay {
    activate = mockActivate;
    deactivate = mockDeactivate;
    showBubble = mockShowBubble;
    hideBubble = mockHideBubble;
    addBadge = mockAddBadge;
    removeBadge = mockRemoveBadge;
    markDisconnected = mockMarkDisconnected;
    destroy = mockOverlayDestroy;
    getShadowRoot = mockGetShadowRoot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set onConfirm(fn: any) { confirmCallback = fn; }
    get onConfirm() { return confirmCallback; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set onCancel(fn: any) { cancelCallback = fn; }
    get onCancel() { return cancelCallback; }
  },
}));

// Import content script module — defineContentScript is stubbed by vitest.setup.ts
import contentModule from '../../entrypoints/content';

describe('content script entry', () => {
  beforeEach(() => {
    // Deactivate from previous test to remove document event listeners
    for (const listener of messageListeners) {
      listener({ type: 'TOGGLE_ANNOTATION', payload: { active: false } });
    }
    messageListeners.length = 0;
    confirmCallback = null;
    cancelCallback = null;
    vi.clearAllMocks();
    document.body.innerHTML = '';
    document.documentElement
      .querySelectorAll('fixit-overlay')
      .forEach((el) => el.remove());

    // Run the main function to register listeners
    const opts = contentModule as unknown as { main: () => void };
    opts.main();
  });

  function sendToggleMessage(active: boolean) {
    for (const listener of messageListeners) {
      listener({ type: 'TOGGLE_ANNOTATION', payload: { active } });
    }
  }

  it('registers a message listener on load', () => {
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  describe('activate', () => {
    it('activates overlay on TOGGLE_ANNOTATION(active=true)', () => {
      sendToggleMessage(true);
      expect(mockActivate).toHaveBeenCalled();
    });
  });

  describe('deactivate', () => {
    it('deactivates overlay and hides highlighter on TOGGLE_ANNOTATION(active=false)', () => {
      sendToggleMessage(true);
      sendToggleMessage(false);
      expect(mockDeactivate).toHaveBeenCalled();
      expect(mockHide).toHaveBeenCalled();
    });
  });

  describe('hover highlighting', () => {
    it('shows highlight on mouseover when active', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(mockShow).toHaveBeenCalledWith(el);
    });

    it('hides highlight on mouseout when active', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));
      expect(mockHide).toHaveBeenCalled();
    });

    it('does not highlight when inactive', () => {
      const el = document.createElement('div');
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      expect(mockShow).not.toHaveBeenCalled();
    });
  });

  describe('click-to-annotate', () => {
    it('shows bubble on element click when active', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.getBoundingClientRect = vi.fn(() => ({
        top: 100, left: 200, width: 150, height: 50,
        right: 350, bottom: 150, x: 200, y: 100, toJSON: () => {},
      }));
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(mockShowBubble).toHaveBeenCalled();
    });

    it('generates CSS selector and XPath on click', async () => {
      const { generateCssSelector, generateXPath } = await import('../../src/content/locator/index');
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, width: 100, height: 50,
        right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {},
      }));
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(generateCssSelector).toHaveBeenCalledWith(el);
      expect(generateXPath).toHaveBeenCalledWith(el);
    });
  });

  describe('annotation confirm', () => {
    it('sends ADD_ANNOTATION message to background on confirm', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, width: 100, height: 50,
        right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {},
      }));
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      if (confirmCallback) {
        confirmCallback('Make this blue');
      }

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_ANNOTATION',
          payload: expect.objectContaining({
            userComment: 'Make this blue',
            cssSelector: '#test',
            xpath: "id('test')/div",
          }),
        }),
      );
    });

    it('adds badge after confirmation', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, width: 100, height: 50,
        right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {},
      }));
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      if (confirmCallback) {
        confirmCallback('Test comment');
      }

      expect(mockAddBadge).toHaveBeenCalled();
    });
  });

  describe('annotation cancel', () => {
    it('hides bubble on cancel', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.getBoundingClientRect = vi.fn(() => ({
        top: 0, left: 0, width: 100, height: 50,
        right: 100, bottom: 50, x: 0, y: 0, toJSON: () => {},
      }));
      document.body.appendChild(el);
      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      if (cancelCallback) {
        cancelCallback();
      }

      expect(mockHideBubble).toHaveBeenCalled();
    });
  });

  describe('HIGHLIGHT message', () => {
    it('shows highlight and scrolls to element when HIGHLIGHT is received', () => {
      sendToggleMessage(true);
      const el = document.createElement('div');
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      for (const listener of messageListeners) {
        listener({ type: 'HIGHLIGHT', payload: { cssSelector: 'div' } });
      }

      expect(mockShow).toHaveBeenCalledWith(el);
      expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    });

    it('does not throw on invalid selector', () => {
      sendToggleMessage(true);

      expect(() => {
        for (const listener of messageListeners) {
          listener({ type: 'HIGHLIGHT', payload: { cssSelector: '###invalid' } });
        }
      }).not.toThrow();
    });
  });
});
