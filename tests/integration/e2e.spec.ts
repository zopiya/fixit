/**
 * Integration tests — verify full data flow across modules:
 *   Content Script → Background → Storage → Side Panel → Exporter
 *
 * Uses real module implementations with Chrome API mocks.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../src/shared/types';

// ─── Chrome API Mock ───
const store: Record<string, unknown> = {};
const tabMessageListeners: Array<(msg: unknown) => void> = [];
const bgMessageListeners: Array<(msg: unknown, sender: unknown, sendResponse: (resp: unknown) => void) => void> = [];
const actionClickListeners: Array<() => void> = [];
const tabActivatedListeners: Array<(info: { tabId: number }) => void> = [];
const tabUpdatedListeners: Array<(tabId: number, changeInfo: { status?: string }) => void> = [];
const tabRemovedListeners: Array<(tabId: number) => void> = [];

const chromeMock = {
  action: {
    onClicked: {
      addListener: vi.fn((fn: () => void) => actionClickListeners.push(fn)),
    },
  },
  sidePanel: {
    open: vi.fn(),
  },
  tabs: {
    sendMessage: vi.fn((tabId: number, msg: unknown) => {
      // Route to content script listeners
      for (const fn of tabMessageListeners) fn(msg);
    }),
    get: vi.fn(async (tabId: number) => ({
      id: tabId,
      url: 'http://localhost:3000/app',
    })),
    query: vi.fn(async () => [{ id: 1, url: 'http://localhost:3000/app' }]),
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
    sendMessage: vi.fn((msg: unknown) => {
      // Route to side panel listeners
      for (const fn of bgMessageListeners) {
        fn(msg, { tab: { id: 1 } }, () => {});
      }
    }),
    onMessage: {
      addListener: vi.fn(
        (fn: (msg: unknown, sender: unknown, sendResponse: (resp: unknown) => void) => void) => {
          bgMessageListeners.push(fn);
        },
      ),
    },
  },
  storage: {
    local: {
      get: vi.fn(async (key: string) => ({ [key]: store[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(store, items);
      }),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);
vi.stubGlobal('crypto', { randomUUID: vi.fn(() => 'test-uuid-integration') });

// ─── Import real modules ───
import {
  normalizeUrl,
  getStorageKey,
  getAnnotations,
  addAnnotation,
  deleteAnnotation,
} from '../../src/shared/storage';
import { generateCssSelector } from '../../src/content/locator/css-selector';
import { generateXPath } from '../../src/content/locator/xpath';
import { exportToMarkdown } from '../../entrypoints/sidepanel/exporter';
import { AnnotationRenderer } from '../../entrypoints/sidepanel/renderer';

// ─── Helpers ───
function makeAnnotation(overrides: Partial<FixItAnnotation> = {}): FixItAnnotation {
  return {
    id: 'test-uuid-integration',
    url: 'http://localhost:3000/app',
    fullUrl: 'http://localhost:3000/app',
    cssSelector: '[data-testid="submit"]',
    cssSelectorConfidence: 'data-attr',
    xpath: "//button[@data-testid='submit']",
    htmlSnapshot: '<button data-testid="submit">Submit</button>',
    userComment: 'Change to blue',
    sequenceIndex: 1,
    createdAt: Date.now(),
    ...overrides,
  };
}

// ─── Tests ───
beforeEach(() => {
  for (const key of Object.keys(store)) delete store[key];
  tabMessageListeners.length = 0;
  bgMessageListeners.length = 0;
  actionClickListeners.length = 0;
  tabActivatedListeners.length = 0;
  tabUpdatedListeners.length = 0;
  tabRemovedListeners.length = 0;
  vi.clearAllMocks();
  document.body.innerHTML = '';
});

describe('integration: locator → annotation creation', () => {
  it('generates CSS selector and XPath for a data-testid element', () => {
    document.body.innerHTML = '<button data-testid="login-btn">Login</button>';
    const el = document.querySelector('button')!;

    const cssResult = generateCssSelector(el);
    const xpathResult = generateXPath(el);

    expect(cssResult.selector).toBe('[data-testid=login-btn]');
    expect(cssResult.confidence).toBe('data-attr');
    expect(xpathResult.xpath).toBeTruthy();
    expect(xpathResult.isRelative).toBe(false); // no stable ancestor with id/data-*
  });

  it('generates CSS selector and XPath for an element with semantic id', () => {
    document.body.innerHTML = `
      <form id="login-form">
        <input name="user" />
        <button type="submit">Login</button>
      </form>
    `;
    const button = document.querySelector('button')!;

    const cssResult = generateCssSelector(button);
    const xpathResult = generateXPath(button);

    // button has no data-attr, no id, no aria — falls through to name or class or structural
    expect(cssResult.selector).toBeTruthy();
    expect(xpathResult.xpath).toContain("id('login-form')");
  });

  it('generates structural selector for bare elements', () => {
    document.body.innerHTML = '<div><span>text</span></div>';
    const span = document.querySelector('span')!;

    const cssResult = generateCssSelector(span);
    expect(cssResult.confidence).toBe('structural');
    expect(cssResult.selector).toContain(':nth-of-type');
  });
});

describe('integration: storage round-trip', () => {
  it('saves and retrieves annotations by normalized URL', async () => {
    const url = 'http://localhost:3000/app';
    const ann = makeAnnotation();

    await addAnnotation(url, ann);
    const retrieved = await getAnnotations(url);

    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].id).toBe(ann.id);
    expect(retrieved[0].userComment).toBe('Change to blue');
  });

  it('normalizes URL by stripping query and hash', () => {
    expect(normalizeUrl('http://localhost:3000/app?tab=settings#top')).toBe(
      'http://localhost:3000/app',
    );
  });

  it('storage key follows fixit: prefix convention', () => {
    expect(getStorageKey('http://localhost:3000/app')).toBe('fixit:http://localhost:3000/app');
  });
});

describe('integration: annotation full lifecycle', () => {
  it('creates annotation, stores it, and retrieves it', async () => {
    // 1. Create annotation from locator output
    document.body.innerHTML = '<button data-testid="action-btn">Action</button>';
    const el = document.querySelector('button')!;
    const cssResult = generateCssSelector(el);
    const xpathResult = generateXPath(el);

    const annotation: FixItAnnotation = {
      id: crypto.randomUUID(),
      url: normalizeUrl('http://localhost:3000/app?ref=home'),
      fullUrl: 'http://localhost:3000/app?ref=home',
      cssSelector: cssResult.selector,
      cssSelectorConfidence: cssResult.confidence,
      xpath: xpathResult.xpath,
      htmlSnapshot: el.outerHTML.slice(0, 500),
      userComment: 'Add hover effect',
      sequenceIndex: 1,
      createdAt: Date.now(),
    };

    // 2. Save to storage
    await addAnnotation(annotation.url, annotation);

    // 3. Retrieve from storage
    const annotations = await getAnnotations(annotation.url);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].cssSelector).toBe('[data-testid=action-btn]');
    expect(annotations[0].cssSelectorConfidence).toBe('data-attr');
    expect(annotations[0].userComment).toBe('Add hover effect');
  });

  it('handles multiple annotations on the same page', async () => {
    const url = 'http://localhost:3000/app';

    await addAnnotation(url, makeAnnotation({ id: 'ann-1', sequenceIndex: 1 }));
    await addAnnotation(url, makeAnnotation({ id: 'ann-2', sequenceIndex: 2 }));
    await addAnnotation(url, makeAnnotation({ id: 'ann-3', sequenceIndex: 3 }));

    const annotations = await getAnnotations(url);
    expect(annotations).toHaveLength(3);
    expect(annotations.map((a) => a.sequenceIndex)).toEqual([1, 2, 3]);
  });
});

describe('integration: side panel renderer + exporter', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('renders annotations and exports valid markdown', async () => {
    const annotations = [
      makeAnnotation({
        id: 'a1',
        sequenceIndex: 1,
        userComment: 'Fix button color',
        cssSelector: '[data-testid="submit"]',
        cssSelectorConfidence: 'data-attr',
      }),
      makeAnnotation({
        id: 'a2',
        sequenceIndex: 2,
        userComment: 'Align header',
        cssSelector: '#header',
        cssSelectorConfidence: 'id',
        xpath: "id('header')",
      }),
    ];

    // Render in side panel
    const renderer = new AnnotationRenderer(container);
    renderer.render(annotations);

    const items = container.querySelectorAll('[data-testid="annotation-item"]');
    expect(items).toHaveLength(2);
    expect(container.textContent).toContain('①');
    expect(container.textContent).toContain('②');
    expect(container.textContent).toContain('Fix button color');
    expect(container.textContent).toContain('Align header');

    // Export to markdown
    const md = await exportToMarkdown(annotations, 'My App', 'http://localhost:3000/app');

    expect(md).toContain('# FixIt Work Order — My App');
    expect(md).toContain('http://localhost:3000/app');
    expect(md).toContain('## ① Fix button color');
    expect(md).toContain('## ② Align header');
    expect(md).toContain('[data-testid="submit"]');
    expect(md).toContain('#header');
    expect(md).toContain('🟢 High');
    expect(md).toContain('**Requirement**');
  });

  it('renderer click triggers highlight callback with correct annotation', () => {
    const annotations = [makeAnnotation({ id: 'click-test' })];
    const renderer = new AnnotationRenderer(container);
    const onHighlight = vi.fn();
    renderer.onHighlight = onHighlight;

    renderer.render(annotations);

    const item = container.querySelector('[data-testid="annotation-item"]') as HTMLElement;
    item.click();

    expect(onHighlight).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'click-test' }),
    );
  });

  it('empty state renders correctly', () => {
    const renderer = new AnnotationRenderer(container);
    renderer.render([]);

    expect(container.querySelector('[data-testid="empty-state"]')).toBeTruthy();
    expect(container.textContent).toContain('No annotations');
  });
});

describe('integration: V2 reserved fields', () => {
  it('V2 fields are optional and undefined by default', () => {
    const ann = makeAnnotation();
    expect(ann.aiRefinedComment).toBeUndefined();
    expect(ann.visualDiff).toBeUndefined();
  });

  it('V2 fields can be set without breaking storage', async () => {
    const ann = makeAnnotation({
      aiRefinedComment: 'Refined comment',
      visualDiff: [{ property: 'color', from: 'red', to: 'blue' }],
    });

    await addAnnotation(ann.url, ann);
    const retrieved = await getAnnotations(ann.url);

    expect(retrieved[0].aiRefinedComment).toBe('Refined comment');
    expect(retrieved[0].visualDiff).toEqual([{ property: 'color', from: 'red', to: 'blue' }]);
  });
});

describe('integration: confidence levels', () => {
  it('produces correct confidence for different element types', () => {
    document.body.innerHTML = `
      <div>
        <button data-testid="by-data">A</button>
        <button id="by-id">B</button>
        <button aria-label="Close">C</button>
        <input name="email" />
        <button class="btn primary">D</button>
        <span>E</span>
      </div>
    `;

    const els = document.querySelectorAll('button, input, span');

    // data-testid → data-attr
    expect(generateCssSelector(els[0]).confidence).toBe('data-attr');

    // id → id
    expect(generateCssSelector(els[1]).confidence).toBe('id');

    // aria-label → aria
    expect(generateCssSelector(els[2]).confidence).toBe('aria');

    // input[name] → name
    expect(generateCssSelector(els[3]).confidence).toBe('name');

    // class → semantic-class
    expect(generateCssSelector(els[4]).confidence).toBe('semantic-class');

    // bare span → structural
    expect(generateCssSelector(els[5]).confidence).toBe('structural');
  });
});

describe('integration: normalizeUrl edge cases', () => {
  it('strips query parameters and hash', () => {
    expect(normalizeUrl('http://localhost:3000/app?tab=settings#top')).toBe(
      'http://localhost:3000/app',
    );
  });

  it('handles URL with port', () => {
    expect(normalizeUrl('http://localhost:3000/path')).toBe('http://localhost:3000/path');
  });

  it('handles URL with trailing slash', () => {
    expect(normalizeUrl('http://example.com/app/')).toBe('http://example.com/app/');
  });

  it('returns input unchanged for invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });

  it('handles HTTPS URLs', () => {
    expect(normalizeUrl('https://example.com/page?q=1#section')).toBe('https://example.com/page');
  });
});

describe('integration: full annotation flow (add → render → delete)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('adds annotations, renders them, then deletes one', async () => {
    const url = 'http://localhost:3000/app';

    // Add two annotations
    await addAnnotation(url, makeAnnotation({ id: 'ann-1', sequenceIndex: 1, userComment: 'First' }));
    await addAnnotation(url, makeAnnotation({ id: 'ann-2', sequenceIndex: 2, userComment: 'Second' }));

    // Retrieve and render
    const annotations = await getAnnotations(url);
    expect(annotations).toHaveLength(2);

    const renderer = new AnnotationRenderer(container);
    renderer.render(annotations);
    expect(container.querySelectorAll('[data-testid="annotation-item"]')).toHaveLength(2);
    expect(container.textContent).toContain('First');
    expect(container.textContent).toContain('Second');

    // Delete first annotation and re-render
    await deleteAnnotation(url, 'ann-1');
    const afterDelete = await getAnnotations(url);
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe('ann-2');

    renderer.render(afterDelete);
    expect(container.querySelectorAll('[data-testid="annotation-item"]')).toHaveLength(1);
    expect(container.textContent).toContain('Second');
    expect(container.textContent).not.toContain('First');
  });
});
