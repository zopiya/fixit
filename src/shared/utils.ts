const CIRCLED_NUMBERS = [
  '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩',
  '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳',
];

export function circledNumber(n: number): string {
  return CIRCLED_NUMBERS[n - 1] ?? `(${n})`;
}

/**
 * Generate an RFC4122 v4 UUID.
 *
 * `crypto.randomUUID()` is only available in secure contexts (HTTPS / localhost),
 * so on plain `http://` pages it is `undefined` and calling it throws. We fall back
 * to `crypto.getRandomValues` (always available), and finally to `Math.random` so
 * annotation creation never fails regardless of the host page.
 */
export function generateId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* insecure context — fall through */
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Per RFC4122 §4.4: set version (4) and variant (10xx) bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
    .slice(6, 8)
    .join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * URL schemes/hosts where content scripts cannot run. Clicking the toolbar icon on
 * these pages must not attempt to message a (non-existent) content script.
 */
export function isInjectableUrl(url: string | undefined): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const blockedProtocols = [
    'chrome:',
    'chrome-extension:',
    'edge:',
    'about:',
    'devtools:',
    'view-source:',
    'data:',
  ];
  if (blockedProtocols.includes(parsed.protocol)) return false;
  // Chrome blocks injection into the Web Store and other gallery pages.
  if (
    parsed.hostname === 'chromewebstore.google.com' ||
    parsed.hostname === 'chrome.google.com'
  ) {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:';
}
