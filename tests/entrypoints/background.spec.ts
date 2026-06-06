import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../src/shared/types';
import { MessageType } from '../../src/shared/types';

// --- Mock chrome APIs ---
const actionClickListeners: Array<() => void> = [];
const messageListeners: Array<(msg: unknown, sender: unknown, sendResponse: (resp: unknown) => void) => void> = [];
const tabActivatedListeners: Array<(info: { tabId: number }) => void> = [];
const tabUpdatedListeners: Array<(tabId: number, changeInfo: { status?: string }) => void> = [];
const tabRemovedListeners: Array<(tabId: number) => void> = [];
const installedListeners: Array<(details: { reason: string }) => void> = [];
const contextMenuClickListeners: Array<(info: { menuItemId: string }) => void> = [];

// In-memory storage mock
const store: Record<string, unknown> = {};
const sessionStore: Record<string, unknown> = {};

const chromeMock = {
  action: {
    onClicked: {
      addListener: vi.fn((fn: () => void) => actionClickListeners.push(fn)),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
  contextMenus: {
    create: vi.fn(),
    onClicked: {
      addListener: vi.fn((fn: (info: { menuItemId: string }) => void) => {
        contextMenuClickListeners.push(fn);
      }),
    },
  },
  tabs: {
    sendMessage: vi.fn(),
    create: vi.fn(async (opts: { url: string }) => ({ id: 99, url: opts.url })),
    get: vi.fn(async (tabId: number) => ({
      id: tabId,
      url: 'http://localhost:3000/dashboard',
    })),
    query: vi.fn(async () => [{ id: 1, url: 'http://localhost:3000/dashboard' }]),
    onActivated: {
      addListener: vi.fn((fn: (info: { tabId: number }) => void) => {
        tabActivatedListeners.push(fn);
      }),
    },
    onUpdated: {
      addListener: vi.fn(
        (fn: (tabId: number, changeInfo: { status?: string }) => void) => {
          tabUpdatedListeners.push(fn);
        },
      ),
    },
    onRemoved: {
      addListener: vi.fn((fn: (tabId: number) => void) => {
        tabRemovedListeners.push(fn);
      }),
    },
  },
  runtime: {
    onMessage: {
      addListener: vi.fn(
        (fn: (msg: unknown, sender: unknown, sendResponse: (resp: unknown) => void) => void) => {
          messageListeners.push(fn);
        },
      ),
    },
    onInstalled: {
      addListener: vi.fn((fn: (details: { reason: string }) => void) => {
        installedListeners.push(fn);
      }),
    },
    sendMessage: vi.fn(),
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
    },
    session: {
      get: vi.fn(async (key: string) => ({ [key]: sessionStore[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(sessionStore, items);
      }),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);

// Mock settings module — uses defaults since store is empty
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

// Mock icon-state module
vi.mock('../../src/shared/icon-state', () => ({
  setIconActive: vi.fn(),
}));

// Import background module (defineBackground stubbed by vitest.setup)
import bgModule from '../../entrypoints/background';

function makeAnnotation(overrides: Partial<FixItAnnotation> = {}): FixItAnnotation {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    url: 'http://localhost:3000/dashboard',
    fullUrl: 'http://localhost:3000/dashboard?tab=settings',
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

describe('background service worker', () => {
  beforeEach(() => {
    actionClickListeners.length = 0;
    messageListeners.length = 0;
    tabActivatedListeners.length = 0;
    tabUpdatedListeners.length = 0;
    tabRemovedListeners.length = 0;
    installedListeners.length = 0;
    contextMenuClickListeners.length = 0;
    for (const key of Object.keys(store)) delete store[key];
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
    vi.clearAllMocks();

    // Run the main function (defineBackground returns the callback directly)
    // Each call creates a fresh activeTabs map
    const mainFn = bgModule as unknown as () => void;
    mainFn();
  });

  describe('action.onClicked', () => {
    it('sends TOGGLE_ANNOTATION to the active tab and opens side panel', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'http://localhost:3000/dashboard' }]);

      await actionClickListeners[0]();

      expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.TOGGLE_ANNOTATION,
          payload: { active: true },
        }),
      );
      expect(chromeMock.sidePanel.open).toHaveBeenCalledWith({ tabId: 1 });
    });

    it('toggles annotation mode off on second click', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'http://localhost:3000/dashboard' }]);

      await actionClickListeners[0]();
      await actionClickListeners[0]();

      expect(chromeMock.tabs.sendMessage).toHaveBeenLastCalledWith(
        1,
        expect.objectContaining({
          type: MessageType.TOGGLE_ANNOTATION,
          payload: { active: false },
        }),
      );
    });

    it('does not message content scripts on restricted pages but still opens the panel', async () => {
      chromeMock.tabs.query.mockResolvedValue([{ id: 5, url: 'chrome://extensions' }]);

      await actionClickListeners[0]();

      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
      expect(chromeMock.sidePanel.open).toHaveBeenCalledWith({ tabId: 5 });
    });
  });

  describe('REQUEST_TOGGLE routing (custom hotkey)', () => {
    it('toggles the sender tab when a content script requests it', async () => {
      const sendResponse = vi.fn();
      await messageListeners[0](
        { type: MessageType.REQUEST_TOGGLE },
        { tab: { id: 7, url: 'http://localhost:3000/dashboard' } },
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
          7,
          expect.objectContaining({
            type: MessageType.TOGGLE_ANNOTATION,
            payload: { active: true },
          }),
        );
      });
    });

    it('ignores the request when there is no sender tab', async () => {
      const sendResponse = vi.fn();
      await messageListeners[0](
        { type: MessageType.REQUEST_TOGGLE },
        {},
        sendResponse,
      );

      expect(chromeMock.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('ADD_ANNOTATION routing', () => {
    it('saves annotation to storage and broadcasts ANNOTATIONS_UPDATED', async () => {
      const ann = makeAnnotation();
      const sendResponse = vi.fn();

      await messageListeners[0](
        { type: MessageType.ADD_ANNOTATION, payload: ann },
        { tab: { id: 1 } },
        sendResponse,
      );

      // Wait for async storage operations to complete
      await vi.waitFor(() => {
        expect(chromeMock.storage.local.set).toHaveBeenCalled();
      });
      await vi.waitFor(() => {
        expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: MessageType.ANNOTATIONS_UPDATED }),
        );
      });
    });
  });

  describe('DELETE_ANNOTATION routing', () => {
    it('removes annotation from storage and broadcasts update', async () => {
      const ann1 = makeAnnotation({ id: 'keep' });
      const ann2 = makeAnnotation({ id: 'delete-me' });
      store['fixit:http://localhost:3000/dashboard'] = { annotations: [ann1, ann2] };

      const sendResponse = vi.fn();
      await messageListeners[0](
        { type: MessageType.DELETE_ANNOTATION, payload: { id: 'delete-me', url: ann2.url } },
        { tab: { id: 1 } },
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(chromeMock.storage.local.set).toHaveBeenCalled();
      });
      const setCall = chromeMock.storage.local.set.mock.calls[0][0] as Record<
        string,
        { annotations: FixItAnnotation[] }
      >;
      expect(setCall['fixit:http://localhost:3000/dashboard'].annotations).toEqual([ann1]);
    });
  });

  describe('GET_ANNOTATIONS routing', () => {
    it('returns stored annotations for a URL', async () => {
      const ann = makeAnnotation();
      store['fixit:http://localhost:3000/dashboard'] = { annotations: [ann] };

      const sendResponse = vi.fn();
      messageListeners[0](
        {
          type: MessageType.GET_ANNOTATIONS,
          payload: { url: 'http://localhost:3000/dashboard' },
        },
        { tab: { id: 1 } },
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({ annotations: [ann] }),
        );
      });
    });
  });

  describe('CLEAR_ALL routing', () => {
    it('clears all annotations for a URL', async () => {
      store['fixit:http://localhost:3000/dashboard'] = {
        annotations: [makeAnnotation()],
      };

      const sendResponse = vi.fn();
      await messageListeners[0](
        { type: MessageType.CLEAR_ALL, payload: { url: 'http://localhost:3000/dashboard' } },
        { tab: { id: 1 } },
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(chromeMock.storage.local.set).toHaveBeenCalled();
      });
      const setCall = chromeMock.storage.local.set.mock.calls[0][0] as Record<
        string,
        { annotations: FixItAnnotation[] }
      >;
      expect(setCall['fixit:http://localhost:3000/dashboard'].annotations).toEqual([]);
    });
  });

  describe('unknown message type', () => {
    it('is ignored gracefully', async () => {
      const sendResponse = vi.fn();
      await messageListeners[0](
        { type: 'UNKNOWN_TYPE' },
        { tab: { id: 1 } },
        sendResponse,
      );

      expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('tab lifecycle', () => {
    it('notifies side panel on tab activated', async () => {
      await tabActivatedListeners[0]({ tabId: 2 });

      await vi.waitFor(() => {
        expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: MessageType.ANNOTATIONS_UPDATED }),
        );
      });
    });

    it('notifies side panel on tab updated (complete)', async () => {
      await tabUpdatedListeners[0](1, { status: 'complete' });

      await vi.waitFor(() => {
        expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
          expect.objectContaining({ type: MessageType.ANNOTATIONS_UPDATED }),
        );
      });
    });

    it('does not notify on incomplete tab updates', async () => {
      await tabUpdatedListeners[0](1, { status: 'loading' });

      expect(chromeMock.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('cleans up activeTabs on tab removed', async () => {
      // Activate annotation mode on tab 1
      chromeMock.tabs.query.mockResolvedValue([{ id: 1, url: 'http://localhost:3000/dashboard' }]);
      await actionClickListeners[0]();

      // Remove tab 1
      tabRemovedListeners[0](1);

      // Re-activate on a new tab to verify the old state was cleaned up
      chromeMock.tabs.query.mockResolvedValue([{ id: 2, url: 'http://localhost:3000/dashboard' }]);
      await actionClickListeners[0]();

      // Should send active:true since tab 2 is fresh (tab 1 was removed)
      expect(chromeMock.tabs.sendMessage).toHaveBeenLastCalledWith(
        2,
        expect.objectContaining({
          type: MessageType.TOGGLE_ANNOTATION,
          payload: { active: true },
        }),
      );
    });
  });

  describe('UPDATE_ANNOTATION routing', () => {
    it('updates an existing annotation in storage', async () => {
      const ann = makeAnnotation({ id: 'update-me', userComment: 'Original' });
      store['fixit:http://localhost:3000/dashboard'] = { annotations: [ann] };

      const sendResponse = vi.fn();
      const updated = makeAnnotation({ id: 'update-me', userComment: 'Updated comment' });
      await messageListeners[0](
        { type: MessageType.UPDATE_ANNOTATION, payload: updated },
        { tab: { id: 1 } },
        sendResponse,
      );

      await vi.waitFor(() => {
        expect(chromeMock.storage.local.set).toHaveBeenCalled();
      });
      const setCall = chromeMock.storage.local.set.mock.calls[0][0] as Record<
        string,
        { annotations: FixItAnnotation[] }
      >;
      expect(setCall['fixit:http://localhost:3000/dashboard'].annotations).toHaveLength(1);
      expect(setCall['fixit:http://localhost:3000/dashboard'].annotations[0].userComment).toBe(
        'Updated comment',
      );
    });
  });

  describe('context menu', () => {
    it('creates context menu on install', async () => {
      await installedListeners[0]({ reason: 'install' });
      expect(chromeMock.contextMenus.create).toHaveBeenCalledWith({
        id: 'fixit-settings',
        title: expect.any(String),
        contexts: ['action'],
      });
    });

    it('opens settings page when context menu item is clicked', () => {
      contextMenuClickListeners[0]({ menuItemId: 'fixit-settings' });
      expect(chromeMock.tabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test/settings.html',
      });
    });

    it('ignores clicks on other menu items', async () => {
      chromeMock.tabs.create.mockClear();
      contextMenuClickListeners[0]({ menuItemId: 'other-item' });
      expect(chromeMock.tabs.create).not.toHaveBeenCalled();
    });
  });
});
