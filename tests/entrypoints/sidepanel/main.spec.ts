import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
import { MessageType } from '../../../src/shared/types';

// Use vi.hoisted so mock variables are available in hoisted vi.mock factories
const { mockRender, mockCopyToClipboard, mockRendererInstances } = vi.hoisted(() => ({
  mockRender: vi.fn(),
  mockCopyToClipboard: vi.fn().mockResolvedValue(true),
  mockRendererInstances: [] as Array<{
    onHighlight: ((ann: FixItAnnotation) => void) | null;
    onDelete: ((ann: FixItAnnotation) => void) | null;
  }>,
}));

// Mock chrome APIs — must be set up before importing main
const messageListeners: Array<(msg: unknown) => void> = [];

const chromeMock = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((fn: (msg: unknown) => void) => {
        messageListeners.push(fn);
      }),
    },
  },
  tabs: {
    query: vi.fn((_query: unknown, cb?: (tabs: unknown[]) => void) => {
      const tabs = [{ id: 1, url: 'http://localhost:3000/dashboard', title: 'Dashboard' }];
      if (cb) cb(tabs);
      return Promise.resolve(tabs);
    }),
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

vi.mock('../../../entrypoints/sidepanel/renderer', () => ({
  AnnotationRenderer: class MockAnnotationRenderer {
    onHighlight: ((ann: FixItAnnotation) => void) | null = null;
    onDelete: ((ann: FixItAnnotation) => void) | null = null;
    render = mockRender;
    clear = vi.fn();
    destroy = vi.fn();
    constructor() {
      mockRendererInstances.push(this);
    }
  },
}));

vi.mock('../../../entrypoints/sidepanel/exporter', () => ({
  exportToMarkdown: vi.fn(() => 'mock markdown'),
  copyToClipboard: mockCopyToClipboard,
}));

// Mock i18n to return predictable values
vi.mock('../../../src/shared/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'sidepanel.title': 'Fix It Annotations',
      'sidepanel.copy': 'Copy',
      'sidepanel.copied': 'Copied!',
      'sidepanel.clear': 'Clear All',
      'sidepanel.clearConfirm': 'Clear all annotations? This cannot be undone.',
      'sidepanel.cleared': 'Cleared',
    };
    return map[key] ?? key;
  },
  setLocale: vi.fn(),
  detectLocale: vi.fn(() => 'en'),
  detectLocaleAsync: vi.fn(async () => 'en'),
}));

// Import after mocks are in place
import { init, _resetState } from '../../../entrypoints/sidepanel/main';

function makeAnnotation(overrides: Partial<FixItAnnotation> = {}): FixItAnnotation {
  return {
    id: '1',
    url: 'http://localhost:3000/dashboard',
    fullUrl: 'http://localhost:3000/dashboard',
    cssSelector: '#btn',
    cssSelectorConfidence: 'id',
    xpath: 'id("btn")',
    htmlSnapshot: '<button id="btn">Click</button>',
    userComment: 'Fix this',
    sequenceIndex: 1,
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  _resetState();
  messageListeners.length = 0;
  mockRendererInstances.length = 0;
  vi.clearAllMocks();
  document.body.innerHTML = `
    <div id="app">
      <div id="annotation-list"></div>
      <div class="toolbar">
        <button id="clear-btn" class="btn btn-clear" title="全部清空">🗑</button>
        <button id="copy-btn" class="btn btn-copy" disabled>复制</button>
      </div>
      <div id="toast"></div>
    </div>
  `;
});

describe('side panel main', () => {
  it('registers a message listener for ANNOTATIONS_UPDATED', async () => {
    await init();
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('requests annotations on load with tab URL', async () => {
    await init();
    expect(chromeMock.tabs.query).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.any(Function),
    );
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: MessageType.GET_ANNOTATIONS, payload: { url: 'http://localhost:3000/dashboard' } },
      expect.any(Function),
    );
  });

  it('renders annotations when ANNOTATIONS_UPDATED is received', async () => {
    await init();
    const annotations = [makeAnnotation()];

    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    expect(mockRender).toHaveBeenCalledWith(annotations);
  });

  it('wires copy button to copy markdown to clipboard', async () => {
    await init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const btn = document.getElementById('copy-btn')!;
    btn.click();

    await vi.waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith('mock markdown');
    });
  });

  it('shows toast after successful copy', async () => {
    await init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const btn = document.getElementById('copy-btn')!;
    btn.click();

    await vi.waitFor(() => {
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toBe('Copied!');
      expect(toast.classList.contains('opacity-100')).toBe(true);
    });
  });

  it('does not export when annotations list is empty', async () => {
    await init();

    const btn = document.getElementById('copy-btn')!;
    btn.click();

    await new Promise((r) => setTimeout(r, 10));
    expect(mockCopyToClipboard).not.toHaveBeenCalled();
  });

  it('sends CLEAR_ALL and clears annotations when clear button is clicked and confirmed', async () => {
    const confirmSpy = vi.fn().mockReturnValue(true);
    vi.stubGlobal('confirm', confirmSpy);
    await init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const clearBtn = document.getElementById('clear-btn')!;
    clearBtn.click();

    expect(confirmSpy).toHaveBeenCalled();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: MessageType.CLEAR_ALL, payload: { url: 'http://localhost:3000/dashboard' } },
    );
    expect(mockRender).toHaveBeenCalledWith([]);
  });

  it('does not clear when user cancels confirmation', async () => {
    const confirmSpy = vi.fn().mockReturnValue(false);
    vi.stubGlobal('confirm', confirmSpy);
    await init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const clearCallsBefore = (chromeMock.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls
      .filter((call: unknown[]) => (call[0] as { type: string }).type === MessageType.CLEAR_ALL);

    const clearBtn = document.getElementById('clear-btn')!;
    clearBtn.click();

    const clearCallsAfter = (chromeMock.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls
      .filter((call: unknown[]) => (call[0] as { type: string }).type === MessageType.CLEAR_ALL);
    expect(clearCallsAfter.length).toBe(clearCallsBefore.length);
  });

  it('does not send CLEAR_ALL when annotations list is empty', async () => {
    await init();

    const clearBtn = document.getElementById('clear-btn')!;
    clearBtn.click();

    const clearCalls = (chromeMock.runtime.sendMessage as ReturnType<typeof vi.fn>).mock.calls
      .filter((call: unknown[]) => (call[0] as { type: string }).type === MessageType.CLEAR_ALL);
    expect(clearCalls).toHaveLength(0);
  });

  it('wires onHighlight to send HIGHLIGHT message via chrome.tabs.sendMessage', async () => {
    await init();

    // Get the renderer instance that init() created
    const renderer = mockRendererInstances[0];
    expect(renderer).toBeTruthy();
    expect(renderer.onHighlight).toBeTruthy();

    // Invoke the onHighlight callback directly
    const ann = makeAnnotation({ id: 'hl-1', cssSelector: '.target-element' });
    renderer.onHighlight!(ann);

    // Verify it queries tabs and sends HIGHLIGHT message
    expect(chromeMock.tabs.query).toHaveBeenCalledWith(
      { active: true, currentWindow: true },
      expect.any(Function),
    );
    expect(chromeMock.tabs.sendMessage).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        type: MessageType.HIGHLIGHT,
        payload: { cssSelector: '.target-element' },
      }),
    );
  });
});
