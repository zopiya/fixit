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
  return (data[key] as { annotations: FixItAnnotation[] } | undefined)?.annotations ?? [];
}

export async function setAnnotations(url: string, annotations: FixItAnnotation[]): Promise<void> {
  const key = getStorageKey(url);
  await chrome.storage.local.set({ [key]: { annotations } });
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
