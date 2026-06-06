import { describe, it, expect, vi, afterEach } from 'vitest';
import { circledNumber, generateId, isInjectableUrl } from '../../src/shared/utils';

describe('circledNumber', () => {
  it('returns circled digits 1-20', () => {
    expect(circledNumber(1)).toBe('①');
    expect(circledNumber(10)).toBe('⑩');
    expect(circledNumber(20)).toBe('⑳');
  });

  it('returns parenthesized number for n > 20', () => {
    expect(circledNumber(21)).toBe('(21)');
    expect(circledNumber(100)).toBe('(100)');
  });

  it('returns fallback for 0', () => {
    expect(circledNumber(0)).toBe('(0)');
  });

  it('returns fallback for negative numbers', () => {
    expect(circledNumber(-1)).toBe('(-1)');
  });
});

describe('generateId', () => {
  const UUID_V4 =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses crypto.randomUUID when available', () => {
    vi.stubGlobal('crypto', { randomUUID: () => 'native-uuid' });
    expect(generateId()).toBe('native-uuid');
  });

  it('falls back to a valid v4 UUID when randomUUID is missing (insecure context)', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i;
        return arr;
      },
    });
    expect(generateId()).toMatch(UUID_V4);
  });

  it('falls back even when crypto is entirely unavailable', () => {
    vi.stubGlobal('crypto', undefined);
    expect(generateId()).toMatch(UUID_V4);
  });

  it('produces unique values across calls', () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
        return arr;
      },
    });
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('isInjectableUrl', () => {
  it('allows http, https and file pages', () => {
    expect(isInjectableUrl('http://example.com')).toBe(true);
    expect(isInjectableUrl('https://example.com/path?q=1')).toBe(true);
    expect(isInjectableUrl('file:///Users/me/page.html')).toBe(true);
  });

  it('blocks browser-internal and extension pages', () => {
    expect(isInjectableUrl('chrome://extensions')).toBe(false);
    expect(isInjectableUrl('chrome-extension://abc/settings.html')).toBe(false);
    expect(isInjectableUrl('edge://settings')).toBe(false);
    expect(isInjectableUrl('about:blank')).toBe(false);
    expect(isInjectableUrl('devtools://devtools/bundled/x.html')).toBe(false);
    expect(isInjectableUrl('view-source:http://example.com')).toBe(false);
  });

  it('blocks the Chrome Web Store', () => {
    expect(isInjectableUrl('https://chromewebstore.google.com/detail/x')).toBe(false);
    expect(isInjectableUrl('https://chrome.google.com/webstore')).toBe(false);
  });

  it('returns false for empty or malformed input', () => {
    expect(isInjectableUrl(undefined)).toBe(false);
    expect(isInjectableUrl('')).toBe(false);
    expect(isInjectableUrl('not a url')).toBe(false);
  });
});
