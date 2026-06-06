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

  // NOTE: Known race condition — addAnnotation reads then writes without
  // atomic locking. Two rapid calls may overwrite each other (last-write-wins).
  // This is acceptable for V1 because annotations are added sequentially
  // by a single user in a single tab. If multi-tab annotation is ever needed,
  // this must be replaced with an atomic read-modify-write operation.
  it('concurrent addAnnotation calls result in last-write-wins', async () => {
    const url = 'http://localhost:3000/dashboard';
    const ann1 = makeAnnotation({ id: 'first', sequenceIndex: 1 });
    const ann2 = makeAnnotation({ id: 'second', sequenceIndex: 2 });

    // Fire both addAnnotation calls simultaneously
    const p1 = addAnnotation(url, ann1);
    const p2 = addAnnotation(url, ann2);
    await Promise.all([p1, p2]);

    // Both calls read the same initial state (empty), so the last write wins.
    // The final stored value should contain exactly one annotation (the last writer's).
    const finalSetCall = chromeMock.storage.local.set.mock.calls[
      chromeMock.storage.local.set.mock.calls.length - 1
    ] as [Record<string, { annotations: FixItAnnotation[] }>];
    const finalAnnotations = finalSetCall[0][`fixit:${url}`].annotations;

    // Last-write-wins: only the second annotation survives
    expect(finalAnnotations).toHaveLength(1);
    expect(finalAnnotations[0].id).toBe('second');
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
