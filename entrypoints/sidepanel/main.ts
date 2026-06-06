import { MessageType } from '../../src/shared/types';
import type { FixItAnnotation, Message } from '../../src/shared/types';
import { AnnotationRenderer } from './renderer';
import { exportToMarkdown, copyToClipboard } from './exporter';

let currentAnnotations: FixItAnnotation[] = [];
let currentUrl = '';

/** Reset internal state — for testing only */
export function _resetState(): void {
  currentAnnotations = [];
  currentUrl = '';
}

export function init(): void {
  const container = document.getElementById('annotation-list');
  if (!container) return;

  const renderer = new AnnotationRenderer(container);

  // Wire highlight callback: send HIGHLIGHT to content script via background
  renderer.onHighlight = (ann: FixItAnnotation) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'HIGHLIGHT',
          payload: { cssSelector: ann.cssSelector },
        });
      }
    });
  };

  // Listen for annotation updates from background
  chrome.runtime.onMessage.addListener((message: Message<unknown>) => {
    if (message.type === MessageType.ANNOTATIONS_UPDATED) {
      const payload = message.payload as {
        annotations: FixItAnnotation[];
        url: string;
      };
      currentAnnotations = payload.annotations;
      currentUrl = payload.url;
      renderer.render(currentAnnotations);
    }
  });

  // Request annotations for current tab on load
  chrome.runtime.sendMessage({ type: MessageType.GET_ANNOTATIONS }, (response) => {
    const data = response as { annotations: FixItAnnotation[] } | undefined;
    if (data?.annotations) {
      currentAnnotations = data.annotations;
      renderer.render(currentAnnotations);
    }
  });

  // Wire export button
  const exportBtn = document.getElementById('export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      if (currentAnnotations.length === 0) return;
      const md = exportToMarkdown(currentAnnotations, document.title, currentUrl);
      await copyToClipboard(md);

      const toast = document.getElementById('toast');
      if (toast) {
        toast.textContent = 'Copied!';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
      }
    });
  }
}

// Auto-init on DOM ready
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
