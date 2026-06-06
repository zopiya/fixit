import type { FixItAnnotation } from './types';

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}

export function getStorageKey(url: string): string {
  return `fixit:${url}`;
}

export async function getAnnotations(url: string): Promise<FixItAnnotation[]> {
  const key = getStorageKey(url);
  const data = await chrome.storage.local.get(key);
  const entry = data[key] as Record<string, unknown> | undefined;
  if (entry && typeof entry === 'object' && Array.isArray(entry.annotations)) {
    return entry.annotations as FixItAnnotation[];
  }
  return [];
}

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StorageQuotaError';
  }
}

export async function setAnnotations(url: string, annotations: FixItAnnotation[]): Promise<void> {
  const key = getStorageKey(url);
  try {
    await chrome.storage.local.set({ [key]: { annotations } });
  } catch (err) {
    // chrome.storage.local rejects when the per-extension quota is exceeded. Surface a
    // typed error so callers can tell the user instead of failing silently.
    const message = err instanceof Error ? err.message : String(err);
    if (/quota/i.test(message)) {
      throw new StorageQuotaError(message);
    }
    throw err;
  }
}

export async function addAnnotation(url: string, annotation: FixItAnnotation): Promise<void> {
  const existing = await getAnnotations(url);
  await setAnnotations(url, [...existing, annotation]);
}

export async function deleteAnnotation(url: string, annotationId: string): Promise<void> {
  const existing = await getAnnotations(url);
  await setAnnotations(url, existing.filter((a) => a.id !== annotationId));
}

export async function clearAnnotations(url: string): Promise<void> {
  await setAnnotations(url, []);
}

export interface FixItExport {
  version: number;
  exportedAt: string;
  data: Record<string, FixItAnnotation[]>;
}

const STORAGE_PREFIX = 'fixit:';
const SETTINGS_KEY = 'fixit:settings';

/** Bundle every page's annotations into a portable object for backup / transfer. */
export async function exportAllAnnotations(): Promise<FixItExport> {
  const all = await chrome.storage.local.get(null);
  const data: Record<string, FixItAnnotation[]> = {};
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith(STORAGE_PREFIX) || key === SETTINGS_KEY) continue;
    const entry = value as { annotations?: FixItAnnotation[] } | undefined;
    if (entry && Array.isArray(entry.annotations) && entry.annotations.length > 0) {
      data[key] = entry.annotations;
    }
  }
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

/**
 * Merge an exported bundle back into storage (by annotation id, so re-importing is safe).
 * Returns the number of annotations written. Throws on a malformed payload.
 */
export async function importAnnotations(payload: unknown): Promise<number> {
  const p = payload as FixItExport | null;
  if (!p || typeof p !== 'object' || !p.data || typeof p.data !== 'object') {
    throw new Error('Invalid FixIt export file');
  }

  const toWrite: Record<string, { annotations: FixItAnnotation[] }> = {};
  let imported = 0;

  for (const [key, anns] of Object.entries(p.data)) {
    if (!key.startsWith(STORAGE_PREFIX) || key === SETTINGS_KEY || !Array.isArray(anns)) continue;
    const url = key.slice(STORAGE_PREFIX.length);
    const existing = await getAnnotations(url);
    const byId = new Map(existing.map((a) => [a.id, a]));
    for (const ann of anns) {
      if (ann && typeof ann.id === 'string') {
        byId.set(ann.id, ann);
        imported++;
      }
    }
    toWrite[key] = { annotations: [...byId.values()] };
  }

  if (Object.keys(toWrite).length > 0) {
    await chrome.storage.local.set(toWrite);
  }
  return imported;
}
