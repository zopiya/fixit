import { MessageType } from '../src/shared/types';
import type { FixItAnnotation, Message } from '../src/shared/types';
import { normalizeUrl, getAnnotations, addAnnotation, deleteAnnotation, clearAnnotations, setAnnotations } from '../src/shared/storage';
import { getSettings } from '../src/shared/settings';
import { setIconActive } from '../src/shared/icon-state';
import { t, setLocale, detectLocale } from '../src/shared/i18n';

async function notifySidePanel(tabId: number): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return;
    const url = normalizeUrl(tab.url);
    const annotations = await getAnnotations(url);
    chrome.runtime.sendMessage({
      type: MessageType.ANNOTATIONS_UPDATED,
      payload: { annotations, url },
      tabId,
    });
  } catch {
    // Tab may have been closed
  }
}

export default defineBackground(() => {
  const activeTabs = new Map<number, boolean>();

  // Open playground on first install + context menu
  chrome.runtime.onInstalled.addListener(async (details) => {
    const settings = await getSettings();
    const locale = settings.locale === 'auto' ? detectLocale() : settings.locale;
    setLocale(locale);

    chrome.contextMenus.create({
      id: 'fixit-settings',
      title: t('contextMenu.settings'),
      contexts: ['action'],
    });

    if (details.reason === 'install' && settings.autoOpenPlayground) {
      chrome.tabs.create({ url: chrome.runtime.getURL('playground.html') });
    }
  });

  chrome.contextMenus.onClicked.addListener((info) => {
    if (info.menuItemId === 'fixit-settings') {
      chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    }
  });

  // D1: action.onClicked toggles annotation mode AND opens side panel
  chrome.action.onClicked.addListener(async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    const isActive = activeTabs.get(tab.id) ?? false;
    const nextState = !isActive;
    activeTabs.set(tab.id, nextState);

    chrome.tabs.sendMessage(tab.id, {
      type: MessageType.TOGGLE_ANNOTATION,
      payload: { active: nextState },
    });

    setIconActive(tab.id, nextState);

    chrome.sidePanel.open({ tabId: tab.id });
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
        case MessageType.ADD_ANNOTATION: {
          const p = message.payload as Record<string, unknown> | undefined;
          if (!p || typeof p.url !== 'string' || typeof p.id !== 'string') break;
          const annotation = p as unknown as FixItAnnotation;
          addAnnotation(annotation.url, annotation).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(console.error);
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
          }).catch(console.error);
          break;
        }

        case MessageType.DELETE_ANNOTATION: {
          const p = message.payload as Record<string, unknown> | undefined;
          const id = typeof p?.id === 'string' ? p.id : undefined;
          const delUrl = typeof p?.url === 'string' ? p.url : undefined;
          if (!id || !delUrl) break;
          deleteAnnotation(delUrl, id).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(console.error);
          break;
        }

        case MessageType.GET_ANNOTATIONS: {
          const getUrl = url;
          if (!getUrl) break;
          getAnnotations(getUrl).then((annotations) => {
            sendResponse({ annotations });
          }).catch(console.error);
          return true; // keep channel open for async response
        }

        case MessageType.CLEAR_ALL: {
          const clearUrl = url;
          if (!clearUrl) break;
          clearAnnotations(clearUrl).then(() => {
            notifySidePanel(tabId ?? 0);
          }).catch(console.error);
          break;
        }

        default:
          // Ignore unknown message types
          break;
      }
    },
  );

  // Tab lifecycle: notify side panel on tab switch or navigation
  chrome.tabs.onActivated.addListener(({ tabId }) => {
    const isActive = activeTabs.get(tabId) ?? false;
    setIconActive(tabId, isActive);
    notifySidePanel(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === 'complete') {
      notifySidePanel(tabId);
    }
  });

  // Cleanup on tab close
  chrome.tabs.onRemoved.addListener((tabId) => {
    activeTabs.delete(tabId);
  });
});
