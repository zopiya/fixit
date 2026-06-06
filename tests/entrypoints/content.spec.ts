import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeUrl } from '../../src/shared/storage';

// Mock chrome APIs
const messageListeners: ((msg: unknown) => void)[] = [];
const storageChangeListeners: ((changes: unknown, area: string) => void)[] = [];
// Single settable entry returned by storage.local.get regardless of key.
let localEntry: unknown = undefined;
const chromeMock = {
  runtime: {
    onMessage: {
      addListener: vi.fn((fn: (msg: unknown) => void) => {
        messageListeners.push(fn);
      }),
    },
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: localEntry })),
      set: vi.fn(async () => {}),
    },
    onChanged: {
      addListener: vi.fn((fn: (changes: unknown, area: string) => void) => {
        storageChangeListeners.push(fn);
      }),
    },
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

// Mock AnnotationOverlay — mount creates a real host element so a highlighter can be created
const mockShowBubble = vi.fn();
const mockHideBubble = vi.fn();
const mockAddBadge = vi.fn();
const mockRemoveBadge = vi.fn();
const mockClearBadges = vi.fn();
const mockMarkDisconnected = vi.fn();
const mockUpdateBadgePositions = vi.fn();
const mockSetBreadcrumbActive = vi.fn();
const mockOverlayDestroy = vi.fn();
const mockGetShadowRoot = vi.fn();
const mockHasBadges = vi.fn(() => false);
let confirmCallback: ((comment: string) => void) | null = null;
let cancelCallback: (() => void) | null = null;
let badgeClickCallback: ((index: number) => void) | null = null;

const mockMount = vi.fn(() => {
  if (!document.documentElement.querySelector('fixit-overlay')) {
    const host = document.createElement('fixit-overlay');
    const shadow = host.attachShadow({ mode: 'closed' });
    document.documentElement.appendChild(host);
    mockGetShadowRoot.mockReturnValue(shadow);
  }
});

const mockUnmount = vi.fn(() => {
  const host = document.documentElement.querySelector('fixit-overlay');
  if (host) host.remove();
  mockGetShadowRoot.mockReturnValue(null);
});

const mockSetModeActive = vi.fn((on: boolean) => {
  if (on) mockMount();
});

vi.mock('../../src/content/overlay', () => ({
  AnnotationOverlay: class MockAnnotationOverlay {
    mount = mockMount;
    unmount = mockUnmount;
    setModeActive = mockSetModeActive;
    hasBadges = mockHasBadges;
    showBubble = mockShowBubble;
    hideBubble = mockHideBubble;
    addBadge = mockAddBadge;
    removeBadge = mockRemoveBadge;
    clearBadges = mockClearBadges;
    markDisconnected = mockMarkDisconnected;
    updateBadgePositions = mockUpdateBadgePositions;
    setBreadcrumbActive = mockSetBreadcrumbActive;
    destroy = mockOverlayDestroy;
    getShadowRoot = mockGetShadowRoot;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set onConfirm(fn: any) { confirmCallback = fn; }
    get onConfirm() { return confirmCallback; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set onCancel(fn: any) { cancelCallback = fn; }
    get onCancel() { return cancelCallback; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    set onBadgeClick(fn: any) { badgeClickCallback = fn; }
    get onBadgeClick() { return badgeClickCallback; }
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
    storageChangeListeners.length = 0;
    confirmCallback = null;
    cancelCallback = null;
    badgeClickCallback = null;
    localEntry = undefined;
    vi.clearAllMocks();
    mockGetShadowRoot.mockReturnValue(null);
    mockHasBadges.mockReturnValue(false);
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
    it('enters annotation mode on TOGGLE_ANNOTATION(active=true)', () => {
      sendToggleMessage(true);
      expect(mockSetModeActive).toHaveBeenCalledWith(true);
    });
  });

  describe('deactivate', () => {
    it('leaves annotation mode and hides highlighter on TOGGLE_ANNOTATION(active=false)', () => {
      sendToggleMessage(true);
      sendToggleMessage(false);
      expect(mockSetModeActive).toHaveBeenCalledWith(false);
      expect(mockHide).toHaveBeenCalled();
      // No badges to keep → the review layer is torn down.
      expect(mockUnmount).toHaveBeenCalled();
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

  describe('custom hotkey', () => {
    const customSettings = {
      highlightColor: '#3B82F6',
      highlightBorderWidth: 2,
      bubbleBorderRadius: 12,
      snapshotMaxLength: 500,
      highlightFlashMs: 2000,
      autoOpenPlayground: true,
      locale: 'auto' as const,
      customHotkey: 'Alt+Shift+F',
      copyContext: {
        comment: true,
        cssSelector: true,
        xpath: true,
        confidence: true,
        htmlSnapshot: false,
      },
    };

    // NOTE: the hotkey listener is attached to `document` for the content script's
    // lifetime (never removed on deactivate), so the empty-hotkey case is asserted FIRST,
    // before any custom handler is registered in this file's run.
    it('does not send a toggle request when customHotkey is empty', async () => {
      sendToggleMessage(false);
      vi.clearAllMocks();
      messageListeners.length = 0;

      // Re-init with empty customHotkey (default mock)
      const opts = contentModule as unknown as { main: () => Promise<void> };
      await opts.main();

      // Dispatch keyboard event — no handler should fire
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F',
          altKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );

      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('sends REQUEST_TOGGLE when the custom hotkey is pressed', async () => {
      sendToggleMessage(false);
      vi.clearAllMocks();
      messageListeners.length = 0;

      // Override settings to include custom hotkey
      const { getSettings } = await import('../../src/shared/settings');
      vi.mocked(getSettings).mockResolvedValueOnce(customSettings);

      // Call main() and await — hotkey handler is registered after async settings load
      const opts = contentModule as unknown as { main: () => Promise<void> };
      await opts.main();

      // Simulate pressing Alt+Shift+F
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'F',
          altKey: true,
          shiftKey: true,
          bubbles: true,
        }),
      );

      // Routed through the background, which owns the authoritative toggle state.
      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUEST_TOGGLE' }),
      );
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

    it('highlights from the side panel even when annotation mode is inactive', () => {
      // Deliberately do NOT activate — this is the review path that was previously broken.
      const el = document.createElement('div');
      el.id = 'standalone-target';
      el.scrollIntoView = vi.fn();
      document.body.appendChild(el);

      for (const listener of messageListeners) {
        listener({ type: 'HIGHLIGHT', payload: { cssSelector: '#standalone-target' } });
      }

      expect(mockShow).toHaveBeenCalledWith(el);
      expect(el.scrollIntoView).toHaveBeenCalled();
    });
  });

  describe('badge review layer', () => {
    it('redraws and relocates badges for saved annotations from storage', async () => {
      const el = document.createElement('div');
      el.id = 'restore-me';
      document.body.appendChild(el);

      localEntry = {
        annotations: [
          {
            sequenceIndex: 3,
            cssSelector: '#restore-me',
            xpath: '',
            userComment: 'restored note',
          },
        ],
      };

      sendToggleMessage(true);

      await vi.waitFor(() => {
        expect(mockAddBadge).toHaveBeenCalledWith(
          el,
          3,
          expect.objectContaining({ comment: 'restored note', cssSelector: '#restore-me' }),
        );
      });
    });

    it('reports un-relocatable annotations as missing via ANNOTATION_STATUS', () => {
      // #ghost is not in the DOM → it should be flagged as missing.
      const key = `fixit:${normalizeUrl(window.location.href)}`;
      for (const listener of storageChangeListeners) {
        listener(
          {
            [key]: {
              newValue: {
                annotations: [
                  { id: 'ghost-1', sequenceIndex: 1, cssSelector: '#ghost', xpath: '', userComment: 'x' },
                ],
              },
            },
          },
          'local',
        );
      }

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ANNOTATION_STATUS',
          payload: expect.objectContaining({ missingIds: ['ghost-1'] }),
        }),
      );
    });

    it('re-renders badges reactively when storage for the page changes', async () => {
      const el = document.createElement('div');
      el.id = 'reactive-target';
      document.body.appendChild(el);

      const key = `fixit:${normalizeUrl(window.location.href)}`;
      for (const listener of storageChangeListeners) {
        listener(
          {
            [key]: {
              newValue: {
                annotations: [
                  {
                    sequenceIndex: 1,
                    cssSelector: '#reactive-target',
                    xpath: '',
                    userComment: 'live',
                  },
                ],
              },
            },
          },
          'local',
        );
      }

      expect(mockAddBadge).toHaveBeenCalledWith(
        el,
        1,
        expect.objectContaining({ comment: 'live' }),
      );
    });
  });

  describe('page side-effect suppression', () => {
    it('blocks page mousedown handlers while annotation mode is active', () => {
      sendToggleMessage(true);
      const link = document.createElement('a');
      const pageHandler = vi.fn();
      link.addEventListener('mousedown', pageHandler);
      document.body.appendChild(link);

      const ev = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
      link.dispatchEvent(ev);

      expect(pageHandler).not.toHaveBeenCalled();
      expect(ev.defaultPrevented).toBe(true);
    });

    it('does not block page events when inactive', () => {
      const link = document.createElement('a');
      const pageHandler = vi.fn();
      link.addEventListener('mousedown', pageHandler);
      document.body.appendChild(link);

      link.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

      expect(pageHandler).toHaveBeenCalled();
    });
  });

  describe('element granularity', () => {
    const rect = () => ({
      top: 0, left: 0, width: 10, height: 10,
      right: 10, bottom: 10, x: 0, y: 0, toJSON: () => {},
    });

    it('passes a breadcrumb to the bubble and re-targets the parent on Alt+ArrowUp', async () => {
      const { generateCssSelector } = await import('../../src/content/locator/index');
      sendToggleMessage(true);

      const section = document.createElement('section');
      const button = document.createElement('button');
      section.appendChild(button);
      document.body.appendChild(section);
      button.getBoundingClientRect = vi.fn(rect);

      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(mockShowBubble).toHaveBeenCalledWith(
        button,
        expect.any(Object),
        expect.objectContaining({
          crumbs: expect.any(Array),
          onPickCrumb: expect.any(Function),
        }),
      );

      vi.mocked(generateCssSelector).mockClear();
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowUp', altKey: true, bubbles: true }),
      );
      // Broadened from <button> up to its <section> parent.
      expect(generateCssSelector).toHaveBeenCalledWith(section);
    });
  });

  describe('editing an existing annotation', () => {
    const rect = () => ({
      top: 0, left: 0, width: 10, height: 10,
      right: 10, bottom: 10, x: 0, y: 0, toJSON: () => {},
    });

    it('prefills the bubble and sends UPDATE_ANNOTATION instead of creating a duplicate', async () => {
      const el = document.createElement('div');
      el.id = 'annotated';
      el.getBoundingClientRect = vi.fn(rect);
      document.body.appendChild(el);

      localEntry = {
        annotations: [
          {
            id: 'edit-1',
            url: 'u',
            fullUrl: 'u',
            cssSelector: '#annotated',
            cssSelectorConfidence: 'id',
            xpath: '',
            htmlSnapshot: '',
            userComment: 'old comment',
            sequenceIndex: 1,
            createdAt: 0,
          },
        ],
      };

      sendToggleMessage(true);
      await vi.waitFor(() => expect(mockAddBadge).toHaveBeenCalled());

      el.dispatchEvent(new MouseEvent('click', { bubbles: true }));

      expect(mockShowBubble).toHaveBeenCalledWith(
        el,
        expect.any(Object),
        expect.objectContaining({ comment: 'old comment' }),
      );

      confirmCallback?.('updated comment');

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'UPDATE_ANNOTATION',
          payload: expect.objectContaining({ id: 'edit-1', userComment: 'updated comment' }),
        }),
      );
    });
  });
});
