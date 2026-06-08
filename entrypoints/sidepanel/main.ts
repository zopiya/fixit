import { MessageType } from '../../src/shared/types';
import type { FixItAnnotation, Message } from '../../src/shared/types';
import { normalizeUrl, getStorageKey } from '../../src/shared/storage';
import { AnnotationRenderer } from './renderer';
import { exportToMarkdown, copyToClipboard } from './exporter';
import { t, setLocale, detectLocaleAsync } from '../../src/shared/i18n';

let currentAnnotations: FixItAnnotation[] = [];
let currentUrl = '';

export function _resetState(): void {
  currentAnnotations = [];
  currentUrl = '';
}

function showToast(message: string): void {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('opacity-0');
  toast.classList.add('opacity-100');
  setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0');
  }, 2000);
}

export async function init(): Promise<void> {
  // Load saved locale preference
  const locale = await detectLocaleAsync();
  setLocale(locale);

  const container = document.getElementById('annotation-list');
  if (!container) return;

  // Apply i18n to static elements
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) el.textContent = t(key);
  });

  // Update clear button title
  const clearBtn = document.getElementById('clear-btn');
  if (clearBtn) clearBtn.title = t('sidepanel.clear');

  const renderer = new AnnotationRenderer(container);

  renderer.onHighlight = (ann: FixItAnnotation) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: MessageType.HIGHLIGHT,
          payload: { cssSelector: ann.cssSelector },
        });
      }
    });
  };

  renderer.onDelete = (ann: FixItAnnotation) => {
    chrome.runtime.sendMessage({
      type: MessageType.DELETE_ANNOTATION,
      payload: { id: ann.id, url: currentUrl },
    });
  };

  chrome.runtime.onMessage.addListener((message: Message<unknown>) => {
    if (message.type === MessageType.ANNOTATIONS_UPDATED) {
      const payload = message.payload as Record<string, unknown> | undefined;
      if (!payload || !Array.isArray(payload.annotations) || typeof payload.url !== 'string') return;
      currentAnnotations = payload.annotations as FixItAnnotation[];
      currentUrl = payload.url;
      renderer.render(currentAnnotations);
      updateCopyButton();
    }

    // Content script reports which annotations can't be located on the current page.
    if (message.type === MessageType.ANNOTATION_STATUS) {
      const payload = message.payload as { url?: string; missingIds?: string[] } | undefined;
      if (!payload || payload.url !== currentUrl) return;
      renderer.setStaleIds(new Set(payload.missingIds ?? []));
      renderer.render(currentAnnotations);
    }

    // Storage quota exceeded — let the user know their last annotation wasn't saved.
    if (message.type === MessageType.STORAGE_ERROR) {
      showToast(t('sidepanel.storageFull'));
    }
  });

  // Storage is the source of truth: re-render whenever this page's annotations change
  // (add / delete / clear), regardless of which context made the change. This is what makes
  // the side panel's own delete button reflect instantly.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[getStorageKey(currentUrl)];
    if (!change) return;
    const next = (change.newValue as { annotations?: FixItAnnotation[] } | undefined)?.annotations;
    currentAnnotations = next ?? [];
    renderer.render(currentAnnotations);
    updateCopyButton();
  });

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tabUrl = tabs[0]?.url;
    if (!tabUrl) return;
    const url = normalizeUrl(tabUrl);
    currentUrl = url;
    chrome.runtime.sendMessage({ type: MessageType.GET_ANNOTATIONS, payload: { url } }, (response) => {
      const data = response as { annotations: FixItAnnotation[] } | undefined;
      if (data?.annotations) {
        currentAnnotations = data.annotations;
        renderer.render(currentAnnotations);
        updateCopyButton();
      }
    });
  });

  function updateCopyButton(): void {
    const btn = document.getElementById('copy-btn') as HTMLButtonElement | null;
    if (btn) btn.disabled = currentAnnotations.length === 0;
  }

  // Copy button
  const copyBtn = document.getElementById('copy-btn');
  if (copyBtn) {
    copyBtn.addEventListener('click', async () => {
      if (currentAnnotations.length === 0) return;
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const pageTitle = tab?.title || 'Untitled';
      const md = await exportToMarkdown(currentAnnotations, pageTitle, currentUrl);
      const ok = await copyToClipboard(md);
      showToast(ok ? t('sidepanel.copied') : t('sidepanel.copyFailed'));
    });
  }

  // Clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (currentAnnotations.length === 0) return;

      const confirmed = window.confirm(t('sidepanel.clearConfirm'));
      if (!confirmed) return;

      chrome.runtime.sendMessage({ type: MessageType.CLEAR_ALL, payload: { url: currentUrl } });
      currentAnnotations = [];
      renderer.render([]);
      updateCopyButton();
      showToast(t('sidepanel.cleared'));
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
