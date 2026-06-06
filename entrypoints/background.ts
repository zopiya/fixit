import { MessageType } from '../src/shared/types';
import type { FixItAnnotation, Message } from '../src/shared/types';
import { normalizeUrl, getAnnotations, addAnnotation, deleteAnnotation, clearAnnotations, setAnnotations, StorageQuotaError } from '../src/shared/storage';
import { getSettings } from '../src/shared/settings';
import { setIconActive } from '../src/shared/icon-state';
import { isInjectableUrl } from '../src/shared/utils';
import { isTabActive, setTabActive, clearTab } from '../src/shared/active-state';
import { t, setLocale, detectLocale } from '../src/shared/i18n';

/** Attach a no-op rejection handler to fire-and-forget Chrome API promises. */
function ignoreRejection(value: unknown): void {
  if (value && typeof (value as Promise<unknown>).catch === 'function') {
    (value as Promise<unknown>).catch(() => {});
  }
}

/** Log a storage failure and, if it's a quota error, tell the side panel to surface it. */
function reportStorageError(err: unknown): void {
  console.error(err);
  if (err instanceof StorageQuotaError) {
    ignoreRejection(chrome.runtime.sendMessage({ type: MessageType.STORAGE_ERROR }));
  }
}

async function notifySidePanel(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    const url = normalizeUrl(tab.url);
    const annotations = await getAnnotations(url);
    ignoreRejection(
      chrome.runtime.sendMessage({
        type: MessageType.ANNOTATIONS_UPDATED,
        payload: { annotations, url },
        tabId,
      }),
    );
  } catch {
    // Tab may have been closed, or no side panel is listening.
  }
}

export default defineBackground(() => {
  async function setLocaleFromSettings(): Promise<void> {
    const settings = await getSettings();
    setLocale(settings.locale === 'auto' ? detectLocale() : settings.locale);
  }

  // Context menus are not persisted across browser restarts, so (re)create them on both
  // install and startup. removeAll() first avoids "duplicate id" errors on updates.
  async function registerContextMenu(): Promise<void> {
    await setLocaleFromSettings();
    const create = () => {
      try {
        chrome.contextMenus.create({
          id: 'fixit-settings',
          title: t('contextMenu.settings'),
          contexts: ['action'],
        });
      } catch {
        /* already exists */
      }
    };
    if (typeof chrome.contextMenus.removeAll === 'function') {
      chrome.contextMenus.removeAll(create);
    } else {
      create();
    }
  }

  // Single authoritative toggle path for both the toolbar icon and the custom hotkey.
  async function toggleTab(tab: chrome.tabs.Tab | undefined, openPanel: boolean): Promise<void> {
    if (!tab?.id) return;

    // On pages where no content script runs (chrome://, Web Store, …) annotation is
    // impossible — surface the side panel for review but don't fake an active state.
    if (tab.url && !isInjectableUrl(tab.url)) {
      if (openPanel) ignoreRejection(chrome.sidePanel.open({ tabId: tab.id }));
      return;
    }

    const nextState = !(await isTabActive(tab.id));
    await setTabActive(tab.id, nextState);

    ignoreRejection(
      chrome.tabs.sendMessage(tab.id, {
        type: MessageType.TOGGLE_ANNOTATION,
        payload: { active: nextState },
      }),
    );
    setIconActive(tab.id, nextState);
    if (openPanel) ignoreRejection(chrome.sidePanel.open({ tabId: tab.id }));
  }

  // Open playground on first install + (re)create context menu
  chrome.runtime.onInstalled.addListener(async (details) => {
    await registerContextMenu();
    const settings = await getSettings();
    if (details.reason === 'install' && settings.autoOpenPlayground) {
      chrome.tabs.create({ url: chrome.runtime.getURL('playground.html') });
    }
  });

  chrome.runtime.onStartup?.addListener(() => {
    void registerContextMenu();
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'fixit-settings') {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  });

  // D1: action.onClicked toggles annotation mode AND opens side panel
  chrome.action.onClicked.addListener(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await toggleTab(tab, true);
  });

  // Message routing from content script and side panel
  chrome.runtime.onMessage.addListener(
    (
      message: Message<unknown>,
      sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void,
    ) => {
      const tabId = sender.tab?.id;
      const url = (message.payload as { url?: string })?.url;

      switch (message.type) {
        case MessageType.REQUEST_TOGGLE: {
          void toggleTab(sender.tab, true);
          break;
        }

        case MessageType.ADD_ANNOTATION: {
          const p = message.payload as Record<string, unknown> | undefined;
          if (!p || typeof p.url !== 'string' || typeof p.id !== 'string') break;
          const annotation = p as unknown as FixItAnnotation;
          addAnnotation(annotation.url, annotation).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(reportStorageError);
          break;
        }

        case MessageType.UPDATE_ANNOTATION: {
          const p = message.payload as Record<string, unknown> | undefined;
          if (!p || typeof p.url !== 'string' || typeof p.id !== 'string') break;
          const updated = p as unknown as FixItAnnotation;
          getAnnotations(updated.url).then((existing) => {
            const list = existing.map((a) => (a.id === updated.id ? updated : a));
            return setAnnotations(updated.url, list).then(() => {
              notifySidePanel(tabId ?? 0);
            });
          }).catch(reportStorageError);
          break;
        }

        case MessageType.DELETE_ANNOTATION: {
          const p = message.payload as Record<string, unknown> | undefined;
          const id = typeof p?.id === 'string' ? p.id : undefined;
          const delUrl = typeof p?.url === 'string' ? p.url : undefined;
          if (!id || !delUrl) break;
          deleteAnnotation(delUrl, id).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(reportStorageError);
          break;
        }

        case MessageType.GET_ANNOTATIONS: {
          const getUrl = url;
          if (!getUrl) break;
          getAnnotations(getUrl).then((annotations) => {
            sendResponse({ annotations });
          }).catch(() => sendResponse({ annotations: [] }));
          return true; // keep channel open for async response
        }

        case MessageType.CLEAR_ALL: {
          const clearUrl = url;
          if (!clearUrl) break;
          clearAnnotations(clearUrl).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(reportStorageError);
          break;
        }

        default:
          // Ignore unknown message types
          break;
      }
    },
  );

  // Tab lifecycle: keep the toolbar badge and side panel in sync with the active tab.
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    isTabActive(tabId).then((active) => setIconActive(tabId, active));
    notifySidePanel(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    // A full document load means the content script restarts fresh (annotation mode OFF),
    // so reset the authoritative state and badge to match — this is what kills the old
    // "looks active but isn't / takes two clicks" desync after a reload or navigation.
    if (changeInfo.status === 'loading') {
      void setTabActive(tabId, false);
      setIconActive(tabId, false);
    }
    // `complete` covers full loads; `changeInfo.url` (without a status change) covers SPA
    // history navigations, keeping the side panel's list in sync with client-side routing.
    if (changeInfo.status === 'complete' || changeInfo.url) {
      notifySidePanel(tabId);
    }
  });

  // Cleanup on tab close
  chrome.tabs.onRemoved.addListener((tabId) => {
    void clearTab(tabId);
  });
});
