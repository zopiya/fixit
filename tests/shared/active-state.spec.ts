import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isTabActive, setTabActive, clearTab } from '../../src/shared/active-state';

const sessionStore: Record<string, unknown> = {};

vi.stubGlobal('chrome', {
  storage: {
    session: {
      get: vi.fn(async (key: string) => ({ [key]: sessionStore[key] })),
      set: vi.fn(async (items: Record<string, unknown>) => {
        Object.assign(sessionStore, items);
      }),
    },
  },
});

describe('active-state (session-backed per-tab mode)', () => {
  beforeEach(() => {
    for (const key of Object.keys(sessionStore)) delete sessionStore[key];
  });

  it('defaults to inactive for unknown tabs', async () => {
    expect(await isTabActive(123)).toBe(false);
  });

  it('persists an active tab', async () => {
    await setTabActive(1, true);
    expect(await isTabActive(1)).toBe(true);
  });

  it('tracks multiple tabs independently', async () => {
    await setTabActive(1, true);
    await setTabActive(2, true);
    await setTabActive(1, false);
    expect(await isTabActive(1)).toBe(false);
    expect(await isTabActive(2)).toBe(true);
  });

  it('clearTab removes a tab from the active set', async () => {
    await setTabActive(5, true);
    await clearTab(5);
    expect(await isTabActive(5)).toBe(false);
  });
});

describe('active-state without session storage', () => {
  it('degrades gracefully when chrome.storage.session is missing', async () => {
    vi.stubGlobal('chrome', { storage: {} });
    await expect(setTabActive(1, true)).resolves.toBeUndefined();
    expect(await isTabActive(1)).toBe(false);
  });
});
