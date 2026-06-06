/**
 * Per-tab "annotation mode" state, persisted in `chrome.storage.session`.
 *
 * MV3 service workers are evicted after ~30s idle, which would wipe any in-memory map and
 * desync the toolbar badge from reality. Session storage survives eviction (but is cleared
 * when the browser closes), making it the right home for ephemeral per-tab UI state.
 */

const KEY = 'fixit:activeTabs';

type ActiveMap = Record<number, true>;

function hasSession(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.storage?.session;
}

async function readMap(): Promise<ActiveMap> {
  if (!hasSession()) return {};
  try {
    const data = await chrome.storage.session.get(KEY);
    const map = data[KEY] as ActiveMap | undefined;
    return map && typeof map === 'object' ? map : {};
  } catch {
    return {};
  }
}

export async function isTabActive(tabId: number): Promise<boolean> {
  const map = await readMap();
  return map[tabId] === true;
}

export async function setTabActive(tabId: number, active: boolean): Promise<void> {
  if (!hasSession()) return;
  const map = await readMap();
  if (active) {
    map[tabId] = true;
  } else {
    delete map[tabId];
  }
  try {
    await chrome.storage.session.set({ [KEY]: map });
  } catch {
    /* session storage unavailable — non-fatal */
  }
}

export async function clearTab(tabId: number): Promise<void> {
  await setTabActive(tabId, false);
}
