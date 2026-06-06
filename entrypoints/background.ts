import { MessageType } from '../src/shared/types';
import type { FixItAnnotation, Message } from '../src/shared/types';
import { normalizeUrl, getAnnotations, addAnnotation, deleteAnnotation, clearAnnotations, setAnnotations } from '../src/shared/storage';

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
          const annotation = message.payload as FixItAnnotation;
          if (!annotation?.url) break;
          addAnnotation(annotation.url, annotation).then(() => {
            notifySidePanel(tabId ?? 0);
          });
          break;
        }

        case MessageType.UPDATE_ANNOTATION: {
          const updated = message.payload as FixItAnnotation;
          if (!updated?.url) break;
          getAnnotations(updated.url).then((existing) => {
            const list = existing.map((a) => (a.id === updated.id ? updated : a));
            setAnnotations(updated.url, list).then(() => {
              notifySidePanel(tabId ?? 0);
            });
          });
          break;
        }

        case MessageType.DELETE_ANNOTATION: {
          const { id, url: delUrl } = message.payload as { id: string; url: string };
          if (!id || !delUrl) break;
          deleteAnnotation(delUrl, id).then(() => {
            notifySidePanel(tabId ?? 0);
          });
          break;
        }

        case MessageType.GET_ANNOTATIONS: {
          const getUrl = url;
          if (!getUrl) break;
          getAnnotations(getUrl).then((annotations) => {
            sendResponse({ annotations });
          });
          return true; // keep channel open for async response
        }

        case MessageType.CLEAR_ALL: {
          const clearUrl = url;
          if (!clearUrl) break;
          clearAnnotations(clearUrl).then(() => {
            notifySidePanel(tabId ?? 0);
          });
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
