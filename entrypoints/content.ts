import { Highlighter } from '../src/content/highlighter';
import { AnnotationOverlay } from '../src/content/overlay';
import { generateCssSelector, generateXPath } from '../src/content/locator/index';
import { MessageType, type CssSelectorConfidence } from '../src/shared/types';
import { getSettings } from '../src/shared/settings';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  async main() {
    let active = false;
    let sequenceIndex = 0;
    let currentTarget: Element | null = null;
    let currentCssResult: { selector: string; confidence: CssSelectorConfidence } | null = null;
    let currentXpathResult: { xpath: string; isRelative: boolean } | null = null;
    let highlighter: Highlighter | null = null;
    let scrollCleanup: (() => void) | null = null;
    let hotkeyHandler: ((e: KeyboardEvent) => void) | null = null;

    const settings = await getSettings();
    const overlay = new AnnotationOverlay();

    overlay.onConfirm = (comment: string) => {
      if (!currentTarget || !currentCssResult || !currentXpathResult) return;

      sequenceIndex++;
      const target = currentTarget;
      const htmlSnapshot = target.outerHTML.slice(0, settings.snapshotMaxLength);

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
      const shadow = overlay.getShadowRoot();
      if (shadow) {
        highlighter = new Highlighter(shadow);
      }

      document.addEventListener('mouseover', onMouseOver, true);
      document.addEventListener('mouseout', onMouseOut, true);
      document.addEventListener('click', onClick, true);

      // Update badge positions on scroll/resize
      let scrollRaf: number | null = null;
      const onScroll = () => {
        if (scrollRaf) return;
        scrollRaf = requestAnimationFrame(() => {
          overlay.updateBadgePositions();
          scrollRaf = null;
        });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      window.addEventListener('resize', onScroll, { passive: true });
      scrollCleanup = () => {
        window.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
      };
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
      if (hotkeyHandler) {
        document.removeEventListener('keydown', hotkeyHandler);
        hotkeyHandler = null;
      }
      scrollCleanup?.();
      scrollCleanup = null;
    }

    chrome.runtime.onMessage.addListener(
      (msg: { type: string; payload?: { active?: boolean; cssSelector?: string } }) => {
        if (msg.type === MessageType.TOGGLE_ANNOTATION) {
          if (msg.payload?.active) {
            activate();
          } else {
            deactivate();
          }
        }

        if (msg.type === MessageType.HIGHLIGHT && msg.payload?.cssSelector) {
          try {
            const el = document.querySelector(msg.payload.cssSelector);
            if (el && highlighter) {
              highlighter.show(el);
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              setTimeout(() => highlighter?.hide(), settings.highlightFlashMs);
            }
          } catch {
            /* invalid selector */
          }
        }
      },
    );

    // Custom hotkey listener
    if (settings.customHotkey) {
      hotkeyHandler = (e: KeyboardEvent) => {
        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
          parts.push(e.key.toUpperCase());
        }
        if (parts.join('+') === settings.customHotkey) {
          chrome.runtime.sendMessage({
            type: MessageType.TOGGLE_ANNOTATION,
            payload: { active: !active },
          });
        }
      };
      document.addEventListener('keydown', hotkeyHandler);
    }
  },
});
