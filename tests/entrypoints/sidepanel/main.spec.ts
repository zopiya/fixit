import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
import { MessageType } from '../../../src/shared/types';

// Use vi.hoisted so mock variables are available in hoisted vi.mock factories
const { mockRender, mockCopyToClipboard } = vi.hoisted(() => ({
  mockRender: vi.fn(),
  mockCopyToClipboard: vi.fn().mockResolvedValue(undefined),
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
    query: vi.fn(async () => [{ id: 1, url: 'http://localhost:3000/dashboard' }]),
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

vi.mock('../../../entrypoints/sidepanel/renderer', () => ({
  AnnotationRenderer: class MockAnnotationRenderer {
    onHighlight: ((ann: FixItAnnotation) => void) | null = null;
    render = mockRender;
    clear = vi.fn();
    destroy = vi.fn();
  },
}));

vi.mock('../../../entrypoints/sidepanel/exporter', () => ({
  exportToMarkdown: vi.fn(() => 'mock markdown'),
  copyToClipboard: mockCopyToClipboard,
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
  vi.clearAllMocks();
  document.body.innerHTML = `
    <div id="app">
      <div id="annotation-list"></div>
      <button id="export-btn">Copy AI Work Order</button>
      <div id="toast" class="hidden"></div>
    </div>
  `;
});

describe('side panel main', () => {
  it('registers a message listener for ANNOTATIONS_UPDATED', () => {
    init();
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('requests annotations on load', () => {
    init();
    expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith(
      { type: MessageType.GET_ANNOTATIONS },
      expect.any(Function),
    );
  });

  it('renders annotations when ANNOTATIONS_UPDATED is received', () => {
    init();
    const annotations = [makeAnnotation()];

    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations },
      });
    }

    expect(mockRender).toHaveBeenCalledWith(annotations);
  });

  it('wires export button to copy markdown to clipboard', async () => {
    init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const btn = document.getElementById('export-btn')!;
    btn.click();

    await vi.waitFor(() => {
      expect(mockCopyToClipboard).toHaveBeenCalledWith('mock markdown');
    });
  });

  it('shows toast after successful copy', async () => {
    init();

    const annotations = [makeAnnotation()];
    for (const listener of messageListeners) {
      listener({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url: 'http://localhost:3000/dashboard' },
      });
    }

    const btn = document.getElementById('export-btn')!;
    btn.click();

    await vi.waitFor(() => {
      const toast = document.getElementById('toast')!;
      expect(toast.textContent).toBe('Copied!');
      expect(toast.classList.contains('hidden')).toBe(false);
    });
  });

  it('does not export when annotations list is empty', async () => {
    init();

    const btn = document.getElementById('export-btn')!;
    btn.click();

    await new Promise((r) => setTimeout(r, 10));
    expect(mockCopyToClipboard).not.toHaveBeenCalled();
  });
});
