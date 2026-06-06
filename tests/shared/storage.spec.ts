import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItAnnotation } from '../../src/shared/types';

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

import {
  normalizeUrl,
  getStorageKey,
  getAnnotations,
  setAnnotations,
  addAnnotation,
  deleteAnnotation,
  clearAnnotations,
} from '../../src/shared/storage';

function makeAnnotation(overrides: Partial<FixItAnnotation> = {}): FixItAnnotation {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    url: 'http://localhost:3000/dashboard',
    fullUrl: 'http://localhost:3000/dashboard?tab=settings#section',
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

beforeEach(() => {
  for (const key of Object.keys(store)) {
    delete store[key];
  }
  vi.clearAllMocks();
});

describe('normalizeUrl', () => {
  it('should strip query string and hash', () => {
    expect(normalizeUrl('http://localhost:3000/dashboard?tab=settings#section')).toBe(
      'http://localhost:3000/dashboard',
    );
  });

  it('should preserve origin and pathname', () => {
    expect(normalizeUrl('https://example.com/app/page')).toBe('https://example.com/app/page');
  });

  it('should handle URLs with port', () => {
    expect(normalizeUrl('http://localhost:5173/')).toBe('http://localhost:5173/');
  });

  it('should return original string on invalid URL', () => {
    expect(normalizeUrl('not-a-url')).toBe('not-a-url');
  });
});

describe('getStorageKey', () => {
  it('should prefix url with "fixit:"', () => {
    expect(getStorageKey('http://localhost:3000/dashboard')).toBe(
      'fixit:http://localhost:3000/dashboard',
    );
  });
});

describe('getAnnotations', () => {
  it('should return empty array when no data exists', async () => {
    const result = await getAnnotations('http://localhost:3000/');
    expect(result).toEqual([]);
  });

  it('should return stored annotations', async () => {
    const ann = makeAnnotation();
    store['fixit:http://localhost:3000/dashboard'] = { annotations: [ann] };

    const result = await getAnnotations('http://localhost:3000/dashboard');
    expect(result).toEqual([ann]);
  });
});

describe('setAnnotations', () => {
  it('should store annotations under the correct key', async () => {
    const ann = makeAnnotation();
    await setAnnotations('http://localhost:3000/dashboard', [ann]);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [ann] },
    });
  });
});

describe('addAnnotation', () => {
  it('should append annotation to existing list', async () => {
    const existing = makeAnnotation({ id: 'existing-id' });
    store['fixit:http://localhost:3000/dashboard'] = { annotations: [existing] };

    const newAnn = makeAnnotation({ id: 'new-id', sequenceIndex: 2 });
    await addAnnotation('http://localhost:3000/dashboard', newAnn);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [existing, newAnn] },
    });
  });

  it('should create list if none exists', async () => {
    const ann = makeAnnotation();
    await addAnnotation('http://localhost:3000/dashboard', ann);

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [ann] },
    });
  });
});

describe('deleteAnnotation', () => {
  it('should remove annotation by id', async () => {
    const ann1 = makeAnnotation({ id: 'keep-id' });
    const ann2 = makeAnnotation({ id: 'delete-id' });
    store['fixit:http://localhost:3000/dashboard'] = { annotations: [ann1, ann2] };

    await deleteAnnotation('http://localhost:3000/dashboard', 'delete-id');

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [ann1] },
    });
  });

  it('should handle deleting from empty list', async () => {
    await deleteAnnotation('http://localhost:3000/dashboard', 'nonexistent');

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [] },
    });
  });
});

describe('clearAnnotations', () => {
  it('should set annotations to empty array', async () => {
    store['fixit:http://localhost:3000/dashboard'] = {
      annotations: [makeAnnotation()],
    };

    await clearAnnotations('http://localhost:3000/dashboard');

    expect(chromeMock.storage.local.set).toHaveBeenCalledWith({
      'fixit:http://localhost:3000/dashboard': { annotations: [] },
    });
  });
});
