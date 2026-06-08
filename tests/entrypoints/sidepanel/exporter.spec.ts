import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
import { setLocale } from '../../../src/shared/i18n';

// Mock settings with copyContext defaults
vi.mock('../../../src/shared/settings', () => ({
  getSettings: vi.fn(async () => ({
    highlightColor: '#3B82F6',
    highlightBorderWidth: 2,
    bubbleBorderRadius: 12,
    snapshotMaxLength: 500,
    highlightFlashMs: 2000,
    autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
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

import { exportToMarkdown, copyToClipboard } from '../../../entrypoints/sidepanel/exporter';

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

describe('exportToMarkdown', () => {
  describe('Chinese locale', () => {
    beforeEach(() => {
      setLocale('zh');
    });

    it('generates valid markdown with header', async () => {
      const md = await exportToMarkdown([], 'Dashboard', 'http://localhost:3000/dashboard');

      expect(md).toContain('# FixIt 修改工单 — Dashboard');
      expect(md).toContain('http://localhost:3000/dashboard');
      expect(md).toContain('**标注数量**: 0');
    });

    it('renders each annotation as a numbered section', async () => {
      const annotations = [
        makeAnnotation({ sequenceIndex: 1, userComment: 'Fix button' }),
        makeAnnotation({
          id: 'other',
          sequenceIndex: 2,
          userComment: 'Align header',
          cssSelector: '#header',
          cssSelectorConfidence: 'id',
        }),
      ];
      const md = await exportToMarkdown(annotations, 'Page', 'http://example.com');

      expect(md).toContain('## ① Fix button');
      expect(md).toContain('## ② Align header');
      expect(md).toContain('**标注数量**: 2');
    });

    it('includes CSS selector, XPath, confidence label, and HTML snapshot', async () => {
      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');

      expect(md).toContain('`[data-testid="submit-btn"]`');
      expect(md).toContain('`//button[@data-testid="submit-btn"]`');
      expect(md).toContain('🟢 高可靠');
    });

    it('maps confidence labels to correct Chinese labels', async () => {
      const cases: Array<[FixItAnnotation['cssSelectorConfidence'], string]> = [
        ['data-attr', '🟢 高可靠'],
        ['id', '🟢 高可靠'],
        ['aria', '🟢 高可靠'],
        ['name', '🟢 高可靠'],
        ['semantic-class', '🟡 中可靠'],
        ['structural', '🔴 低可靠'],
      ];

      for (const [confidence, label] of cases) {
        const ann = makeAnnotation({ cssSelectorConfidence: confidence });
        const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
        expect(md).toContain(label);
      }
    });

    it('produces minimal header for empty annotations', async () => {
      const md = await exportToMarkdown([], 'Title', 'http://example.com');
      expect(md).toContain('# FixIt 修改工单 — Title');
      expect(md).not.toContain('## ①');
    });

    it('escapes special characters in code blocks', async () => {
      const ann = makeAnnotation({
        cssSelector: 'div[data-v-abc123] > .btn-primary',
        xpath: '//div[@data-v-abc123]//button',
      });
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');

      expect(md).toContain('`div[data-v-abc123] > .btn-primary`');
      expect(md).toContain('`//div[@data-v-abc123]//button`');
    });

    it('includes 修改要求 label before comment', async () => {
      const ann = makeAnnotation({ userComment: 'Make this bigger and blue' });
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');

      expect(md).toContain('**修改要求**： Make this bigger and blue');
    });

    it('includes 元素定位 section header', async () => {
      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');

      expect(md).toContain('**元素定位**：');
    });
  });

  describe('English locale', () => {
    beforeEach(() => {
      setLocale('en');
    });

    it('generates valid markdown with English header', async () => {
      const md = await exportToMarkdown([], 'Dashboard', 'http://localhost:3000/dashboard');

      expect(md).toContain('# FixIt Work Order — Dashboard');
      expect(md).toContain('**Annotations**: 0');
    });

    it('uses English labels for sections', async () => {
      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');

      expect(md).toContain('**Requirement**:');
      expect(md).toContain('**Element Locator**:');
      expect(md).toContain('🟢 High');
    });
  });

  describe('copyContext filtering', () => {
    beforeEach(() => {
      setLocale('en');
    });

    it('excludes CSS selector when cssSelector is false', async () => {
      const { getSettings } = await import('../../../src/shared/settings');
      vi.mocked(getSettings).mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'auto',
        customHotkey: '',
        copyContext: { comment: true, cssSelector: false, xpath: true, confidence: true, htmlSnapshot: false },
      });

      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
      expect(md).not.toContain('CSS Selector');
      expect(md).toContain('XPath');
    });

    it('excludes XPath when xpath is false', async () => {
      const { getSettings } = await import('../../../src/shared/settings');
      vi.mocked(getSettings).mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'auto',
        customHotkey: '',
        copyContext: { comment: true, cssSelector: true, xpath: false, confidence: true, htmlSnapshot: false },
      });

      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
      expect(md).toContain('CSS Selector');
      expect(md).not.toContain('XPath');
    });

    it('excludes comment when comment is false', async () => {
      const { getSettings } = await import('../../../src/shared/settings');
      vi.mocked(getSettings).mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'auto',
        customHotkey: '',
        copyContext: { comment: false, cssSelector: true, xpath: true, confidence: true, htmlSnapshot: false },
      });

      const ann = makeAnnotation({ userComment: 'Fix this' });
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
      // Requirement line is excluded, but title still uses comment text
      expect(md).not.toContain('**Requirement**');
      expect(md).toContain('## ① Fix this');
    });

    it('includes HTML snapshot when htmlSnapshot is true', async () => {
      const { getSettings } = await import('../../../src/shared/settings');
      vi.mocked(getSettings).mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'auto',
        customHotkey: '',
        copyContext: { comment: true, cssSelector: true, xpath: true, confidence: true, htmlSnapshot: true },
      });

      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
      expect(md).toContain('```html');
      expect(md).toContain('<button data-testid="submit-btn">Submit</button>');
    });

    it('excludes HTML snapshot when htmlSnapshot is false (default)', async () => {
      const ann = makeAnnotation();
      const md = await exportToMarkdown([ann], 'Page', 'http://example.com');
      expect(md).not.toContain('```html');
    });
  });
});

describe('copyToClipboard', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('calls navigator.clipboard.writeText with the markdown', async () => {
    const result = await copyToClipboard('test markdown');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test markdown');
    expect(result).toBe(true);
  });

  it('returns false when clipboard write fails', async () => {
    vi.stubGlobal('navigator', {
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error('Permission denied')),
      },
    });
    const result = await copyToClipboard('test markdown');
    expect(result).toBe(false);
  });
});
