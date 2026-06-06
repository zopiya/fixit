import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { FixItAnnotation } from '../../../src/shared/types';
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
  it('generates valid markdown with header', () => {
    const md = exportToMarkdown([], 'Dashboard', 'http://localhost:3000/dashboard');

    expect(md).toContain('# FixIt Work Order — Dashboard');
    expect(md).toContain('http://localhost:3000/dashboard');
    expect(md).toContain('**Annotations**: 0');
  });

  it('renders each annotation as a numbered section', () => {
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
    const md = exportToMarkdown(annotations, 'Page', 'http://example.com');

    expect(md).toContain('## ① Fix button');
    expect(md).toContain('## ② Align header');
    expect(md).toContain('**Annotations**: 2');
  });

  it('includes CSS selector, XPath, confidence, and HTML snapshot', () => {
    const ann = makeAnnotation();
    const md = exportToMarkdown([ann], 'Page', 'http://example.com');

    expect(md).toContain('`[data-testid="submit-btn"]`');
    expect(md).toContain('`//button[@data-testid="submit-btn"]`');
    expect(md).toContain('🟢 data-attr');
    expect(md).toContain('<button data-testid="submit-btn">Submit</button>');
  });

  it('maps confidence labels to correct emoji', () => {
    const cases: Array<[FixItAnnotation['cssSelectorConfidence'], string]> = [
      ['data-attr', '🟢'],
      ['id', '🟢'],
      ['aria', '🟢'],
      ['name', '🟢'],
      ['semantic-class', '🟡'],
      ['structural', '🔴'],
    ];

    for (const [confidence, emoji] of cases) {
      const ann = makeAnnotation({ cssSelectorConfidence: confidence });
      const md = exportToMarkdown([ann], 'Page', 'http://example.com');
      expect(md).toContain(`${emoji} ${confidence}`);
    }
  });

  it('produces minimal header for empty annotations', () => {
    const md = exportToMarkdown([], 'Title', 'http://example.com');
    expect(md).toContain('# FixIt Work Order — Title');
    expect(md).not.toContain('## ①');
  });

  it('escapes special characters in code blocks', () => {
    const ann = makeAnnotation({
      cssSelector: 'div[data-v-abc123] > .btn-primary',
      xpath: '//div[@data-v-abc123]//button',
    });
    const md = exportToMarkdown([ann], 'Page', 'http://example.com');

    expect(md).toContain('`div[data-v-abc123] > .btn-primary`');
    expect(md).toContain('`//div[@data-v-abc123]//button`');
  });

  it('includes user comment in the section body', () => {
    const ann = makeAnnotation({ userComment: 'Make this bigger and blue' });
    const md = exportToMarkdown([ann], 'Page', 'http://example.com');

    expect(md).toContain('Make this bigger and blue');
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
    await copyToClipboard('test markdown');
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test markdown');
  });
});
