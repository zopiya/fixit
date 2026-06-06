import { Highlighter } from '../src/content/highlighter';
import { AnnotationOverlay } from '../src/content/overlay';
import { generateCssSelector, generateXPath } from '../src/content/locator/index';
import { MessageType } from '../src/shared/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let active = false;
    let sequenceIndex = 0;
    let currentTarget: Element | null = null;
    let currentCssResult: { selector: string; confidence: string } | null = null;
    let currentXpathResult: { xpath: string; isRelative: boolean } | null = null;
    let highlighter: Highlighter | null = null;

    const overlay = new AnnotationOverlay();

    overlay.onConfirm = (comment: string) => {
      if (!currentTarget || !currentCssResult || !currentXpathResult) return;

      sequenceIndex++;
      const target = currentTarget;
      const htmlSnapshot = target.outerHTML.slice(0, 500);

      overlay.addBadge(target, sequenceIndex);
      overlay.hideBubble();

      chrome.runtime.sendMessage({
        type: MessageType.ADD_ANNOTATION,
        payload: {
          id: crypto.randomUUID(),
          url: window.location.origin + window.location.pathname,
          fullUrl: window.location.href,
          cssSelector: currentCssResult.selector,
          cssSelectorConfidence: currentCssResult.confidence,
          xpath: currentXpathResult.xpath,
          htmlSnapshot,
          userComment: comment,
          sequenceIndex,
          createdAt: Date.now(),
        },
      });

      currentTarget = null;
      currentCssResult = null;
      currentXpathResult = null;
    };

    overlay.onCancel = () => {
      overlay.hideBubble();
      currentTarget = null;
      currentCssResult = null;
      currentXpathResult = null;
    };

    function onMouseOver(e: MouseEvent) {
      if (!active) return;
      const target = e.target as Element;
      if (target === document.documentElement || target === document.body) return;
      if (highlighter) highlighter.show(target);
    }

    function onMouseOut() {
      if (!active) return;
      if (highlighter) highlighter.hide();
    }

    function onClick(e: MouseEvent) {
      if (!active) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      if (target === document.documentElement || target === document.body) return;

      currentTarget = target;
      currentCssResult = generateCssSelector(target);
      currentXpathResult = generateXPath(target);

      if (highlighter) highlighter.hide();

      const rect = target.getBoundingClientRect();
      overlay.showBubble(target, {
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
    }

    function activate() {
      if (active) return;
      active = true;
      overlay.activate();

      // Create highlighter using overlay's shadow root
      const host = document.documentElement.querySelector('fixit-overlay') as
        | (HTMLElement & Record<string, unknown>)
        | null;
      const shadow = host?.__fixitShadow as ShadowRoot | undefined;
      if (shadow) {
        highlighter = new Highlighter(shadow);
      }

      document.addEventListener('mouseover', onMouseOver, true);
      document.addEventListener('mouseout', onMouseOut, true);
      document.addEventListener('click', onClick, true);
    }

    function deactivate() {
      if (!active) return;
      active = false;
      overlay.deactivate();
      if (highlighter) {
        highlighter.hide();
        highlighter = null;
      }
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
    }

    chrome.runtime.onMessage.addListener(
      (msg: { type: string; payload?: { active?: boolean } }) => {
        if (msg.type === MessageType.TOGGLE_ANNOTATION) {
          if (msg.payload?.active) {
            activate();
          } else {
            deactivate();
          }
        }
      },
    );
  },
});
