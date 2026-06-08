import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome.storage.local
const store: Record<string, unknown> = {};
const chromeMock = {
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

import { getDefaults, getSettings, saveSettings, resetSettings } from '../../src/shared/settings';

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.clearAllMocks();
});

describe('getDefaults()', () => {
  it('returns correct defaults', () => {
    const defaults = getDefaults();
    expect(defaults.highlightColor).toBe('#3B82F6');
    expect(defaults.highlightBorderWidth).toBe(2);
    expect(defaults.bubbleBorderRadius).toBe(12);
    expect(defaults.snapshotMaxLength).toBe(500);
    expect(defaults.highlightFlashMs).toBe(2000);
    expect(defaults.autoOpenPlayground).toBe(true);
    expect(defaults.submitShortcut).toBe('mod-enter');
    expect(defaults.locale).toBe('auto');
    expect(defaults.copyContext).toEqual({
      comment: true,
      cssSelector: true,
      xpath: true,
      confidence: true,
      htmlSnapshot: false,
    });
  });

  it('returns a new object each time (no mutation)', () => {
    const a = getDefaults();
    const b = getDefaults();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('getSettings()', () => {
  it('returns defaults when storage is empty', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(getDefaults());
  });

  it('merges saved values with defaults', async () => {
    store['fixit:settings'] = { highlightColor: '#FF0000', locale: 'zh' };
    const settings = await getSettings();
    expect(settings.highlightColor).toBe('#FF0000');
    expect(settings.locale).toBe('zh');
    expect(settings.highlightBorderWidth).toBe(2); // default
    expect(settings.snapshotMaxLength).toBe(500); // default
  });

  it('returns defaults on storage error', async () => {
    chromeMock.storage.local.get.mockRejectedValueOnce(new Error('no chrome'));
    const settings = await getSettings();
    expect(settings).toEqual(getDefaults());
  });
});

describe('saveSettings()', () => {
  it('merges with existing settings', async () => {
    store['fixit:settings'] = { highlightColor: '#FF0000' };
    await saveSettings({ highlightBorderWidth: 4 });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:settings': expect.objectContaining({
        highlightColor: '#FF0000',
        highlightBorderWidth: 4,
      }),
    });
  });

  it('saves partial settings over defaults', async () => {
    await saveSettings({ snapshotMaxLength: 1000 });

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:settings': expect.objectContaining({
        snapshotMaxLength: 1000,
        highlightColor: '#3B82F6', // default preserved
      }),
    });
  });
});

describe('resetSettings()', () => {
  it('restores defaults', async () => {
    store['fixit:settings'] = { highlightColor: '#FF0000', locale: 'en' };
    await resetSettings();

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:settings': getDefaults(),
    });
  });
});
