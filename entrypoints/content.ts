import { Highlighter } from '../src/content/highlighter';
import { AnnotationOverlay } from '../src/content/overlay';
import { generateCssSelector, generateXPath } from '../src/content/locator/index';
import { MessageType, type CssSelectorConfidence, type FixItAnnotation } from '../src/shared/types';
import { getSettings } from '../src/shared/settings';
import { normalizeUrl, getAnnotations, getStorageKey } from '../src/shared/storage';
import { generateId } from '../src/shared/utils';

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
    let escHandler: ((e: KeyboardEvent) => void) | null = null;

    // Standalone highlighter (its own closed shadow root) used for "flash" highlights
    // triggered from the side panel or badge clicks — works regardless of annotation mode.
    let flashHighlighter: Highlighter | null = null;
    let flashTimer: ReturnType<typeof setTimeout> | null = null;

    // Maps badge sequence index -> the element it currently points at, so badge clicks
    // can re-highlight the relocated element.
    const badgeTargets = new Map<number, Element>();

    // Picking session state (set while the annotation bubble is open).
    let pickChain: Element[] = [];
    let pickIndex = 0;
    let editingId: string | null = null;
    let currentAnnotations: FixItAnnotation[] = [];

    const settings = await getSettings();
    const overlay = new AnnotationOverlay();

    const MAX_CRUMBS = 6;

    function describeElement(el: Element): string {
      const tag = el.tagName.toLowerCase();
      if (el.id) return `${tag}#${el.id}`.slice(0, 28);
      const firstClass = (el.getAttribute('class') || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)[0];
      return (firstClass ? `${tag}.${firstClass}` : tag).slice(0, 28);
    }

    // Ancestor chain (shallow → deep), capped to the deepest few levels for the breadcrumb.
    function buildChain(el: Element): Element[] {
      const chain: Element[] = [];
      let cur: Element | null = el;
      while (cur && cur !== document.documentElement) {
        chain.unshift(cur);
        if (cur === document.body) break;
        cur = cur.parentElement;
      }
      return chain.slice(-MAX_CRUMBS);
    }

    function findAnnotationForElement(el: Element): FixItAnnotation | null {
      for (const ann of currentAnnotations) {
        if (badgeTargets.get(ann.sequenceIndex) === el) return ann;
      }
      return null;
    }

    const pageUrl = (): string => normalizeUrl(window.location.href);

    function sendMessageSafe(message: unknown): void {
      try {
        const maybePromise = chrome.runtime.sendMessage(message) as unknown;
        if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === 'function') {
          (maybePromise as Promise<unknown>).catch(() => {
            /* receiving end may not exist — ignore */
          });
        }
      } catch {
        /* extension context invalidated (e.g. during reload) — ignore */
      }
    }

    function relocate(annotation: Pick<FixItAnnotation, 'cssSelector' | 'xpath'>): Element | null {
      if (annotation.cssSelector) {
        try {
          const el = document.querySelector(annotation.cssSelector);
          if (el) return el;
        } catch {
          /* invalid selector — fall back to xpath */
        }
      }
      if (annotation.xpath && typeof document.evaluate === 'function') {
        try {
          const result = document.evaluate(
            annotation.xpath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null,
          );
          if (result.singleNodeValue instanceof Element) return result.singleNodeValue;
        } catch {
          /* malformed xpath — give up */
        }
      }
      return null;
    }

    function ensureFlashHighlighter(): Highlighter {
      if (!flashHighlighter) {
        const flashHost = document.createElement('fixit-flash');
        const shadow = flashHost.attachShadow({ mode: 'closed' });
        document.documentElement.appendChild(flashHost);
        flashHighlighter = new Highlighter(shadow);
      }
      return flashHighlighter;
    }

    function flashHighlight(element: Element): void {
      const hl = ensureFlashHighlighter();
      hl.show(element);
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (flashTimer) clearTimeout(flashTimer);
      flashTimer = setTimeout(() => {
        flashHighlighter?.hide();
        flashTimer = null;
      }, settings.highlightFlashMs);
    }

    // The persistent review layer: (re)draw a badge for every stored annotation by relocating
    // its element. Runs on load, on every storage change, and on SPA route changes — so badges
    // never go stale relative to what's actually saved.
    function renderBadges(annotations: FixItAnnotation[]): void {
      overlay.clearBadges();
      badgeTargets.clear();
      currentAnnotations = annotations;

      const missingIds: string[] = [];
      for (const ann of annotations) {
        sequenceIndex = Math.max(sequenceIndex, ann.sequenceIndex);
        const element = relocate(ann);
        if (element) {
          overlay.addBadge(element, ann.sequenceIndex, {
            comment: ann.userComment,
            cssSelector: ann.cssSelector,
          });
          badgeTargets.set(ann.sequenceIndex, element);
        } else if (typeof ann.id === 'string') {
          // Un-relocatable annotations remain in the side panel (flagged as stale there) so
          // the work order is never silently dropped; we just can't anchor a badge to them.
          missingIds.push(ann.id);
        }
      }

      // Tear the host down once it has nothing to show and we're not actively annotating.
      if (!active && !overlay.hasBadges()) overlay.unmount();

      // Report which annotations couldn't be found so the side panel can flag them.
      sendMessageSafe({
        type: MessageType.ANNOTATION_STATUS,
        payload: { url: pageUrl(), missingIds },
      });
    }

    async function loadAndRenderBadges(): Promise<void> {
      try {
        const annotations = await getAnnotations(pageUrl());
        renderBadges(annotations);
      } catch {
        /* storage unavailable — leave layer empty */
      }
    }

    function resetPickSession(): void {
      currentTarget = null;
      currentCssResult = null;
      currentXpathResult = null;
      pickChain = [];
      pickIndex = 0;
      editingId = null;
    }

    overlay.onConfirm = (comment: string) => {
      if (!currentTarget || !currentCssResult || !currentXpathResult) return;

      const target = currentTarget;
      const htmlSnapshot = target.outerHTML.slice(0, settings.snapshotMaxLength);

      if (editingId) {
        // Update an existing annotation in place (keep id / order / created time).
        const existing = currentAnnotations.find((a) => a.id === editingId);
        if (existing) {
          sendMessageSafe({
            type: MessageType.UPDATE_ANNOTATION,
            payload: {
              ...existing,
              cssSelector: currentCssResult.selector,
              cssSelectorConfidence: currentCssResult.confidence,
              xpath: currentXpathResult.xpath,
              htmlSnapshot,
              userComment: comment,
            },
          });
        }
        overlay.hideBubble();
        resetPickSession();
        return;
      }

      sequenceIndex++;
      // Optimistic badge for instant feedback; the storage.onChanged round-trip reconciles it.
      overlay.addBadge(target, sequenceIndex, { comment, cssSelector: currentCssResult.selector });
      overlay.hideBubble();
      badgeTargets.set(sequenceIndex, target);

      sendMessageSafe({
        type: MessageType.ADD_ANNOTATION,
        payload: {
          id: generateId(),
          url: pageUrl(),
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

      resetPickSession();
    };

    overlay.onCancel = () => {
      overlay.hideBubble();
      resetPickSession();
    };

    overlay.onBadgeClick = (index: number) => {
      const element = badgeTargets.get(index);
      if (element && element.isConnected) {
        flashHighlight(element);
      } else {
        overlay.markDisconnected(index);
      }
    };

    function onMouseOver(e: MouseEvent) {
      if (!active) return;
      // Don't highlight our own overlay (the bubble retargets to the host element) — doing so
      // drew a flickering box over the bubble while the user was typing. Also pause hover
      // highlighting entirely while the bubble is open, to keep focus on the comment.
      if (isFixitHost(e.target) || currentTarget) return;
      const target = e.target as Element;
      if (target === document.documentElement || target === document.body) return;
      if (highlighter) highlighter.show(target);
    }

    function onMouseOut() {
      if (!active) return;
      if (highlighter) highlighter.hide();
    }

    // Re-target the candidate element within the current ancestor chain (breadcrumb / Alt+arrow).
    function selectCandidate(index: number): void {
      if (pickChain.length === 0) return;
      pickIndex = Math.max(0, Math.min(index, pickChain.length - 1));
      const el = pickChain[pickIndex];
      currentTarget = el;
      currentCssResult = generateCssSelector(el);
      currentXpathResult = generateXPath(el);
      editingId = findAnnotationForElement(el)?.id ?? null;
      if (highlighter) highlighter.show(el);
      overlay.setBreadcrumbActive(pickIndex);
    }

    function onClick(e: MouseEvent) {
      if (!active) return;
      // Clicks inside our own overlay (bubble, chips) retarget to the host element — ignore
      // them so interacting with the UI never re-triggers annotation.
      if (isFixitHost(e.target)) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as Element;
      if (target === document.documentElement || target === document.body) return;

      pickChain = buildChain(target);
      pickIndex = pickChain.length - 1;
      currentTarget = target;
      currentCssResult = generateCssSelector(target);
      currentXpathResult = generateXPath(target);

      const existing = findAnnotationForElement(target);
      editingId = existing?.id ?? null;

      if (highlighter) highlighter.hide();

      const rect = target.getBoundingClientRect();
      overlay.showBubble(
        target,
        { x: rect.left + rect.width / 2, y: rect.top },
        {
          comment: existing?.userComment,
          crumbs: pickChain.map(describeElement),
          activeCrumb: pickIndex,
          onPickCrumb: selectCandidate,
          submitMode: settings.submitShortcut,
        },
      );
    }

    // Page-mutating pointer/form events that must be suppressed while picking, so clicking
    // to annotate never triggers the page's own behavior (navigation, dropdowns, submits).
    const BLOCKED_EVENTS = [
      'mousedown',
      'pointerdown',
      'mouseup',
      'pointerup',
      'dblclick',
      'contextmenu',
      'submit',
    ] as const;

    function isFixitHost(node: EventTarget | null): boolean {
      const tag = (node as Element | null)?.tagName?.toLowerCase();
      return !!tag && tag.startsWith('fixit-');
    }

    const blockEvent = (e: Event) => {
      if (!active) return;
      if (isFixitHost(e.target)) return; // never block our own UI
      e.preventDefault();
      e.stopPropagation();
    };

    function setCursorMode(on: boolean) {
      const cls = 'fixit-annotating';
      const styleId = 'fixit-cursor-style';
      if (on) {
        if (!document.getElementById(styleId)) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = `html.${cls}, html.${cls} * { cursor: crosshair !important; }`;
          (document.head || document.documentElement).appendChild(style);
        }
        document.documentElement.classList.add(cls);
      } else {
        document.documentElement.classList.remove(cls);
        document.getElementById(styleId)?.remove();
      }
    }

    function activate() {
      if (active) return;
      active = true;
      overlay.setModeActive(true);
      setCursorMode(true);

      const shadow = overlay.getShadowRoot();
      if (shadow) {
        highlighter = new Highlighter(shadow);
      }

      document.addEventListener('mouseover', onMouseOver, true);
      document.addEventListener('mouseout', onMouseOut, true);
      document.addEventListener('click', onClick, true);
      for (const type of BLOCKED_EVENTS) {
        document.addEventListener(type, blockEvent, true);
      }

      // Keyboard while in mode:
      //  • Esc with no open bubble → exit annotation mode (bubble owns Esc-to-cancel itself)
      //  • Alt+↑ / Alt+↓ while picking → broaden / narrow the targeted element
      escHandler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !currentTarget) {
          sendMessageSafe({ type: MessageType.REQUEST_TOGGLE });
          return;
        }
        if (currentTarget && e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          e.stopPropagation();
          selectCandidate(e.key === 'ArrowUp' ? pickIndex - 1 : pickIndex + 1);
        }
      };
      document.addEventListener('keydown', escHandler, true);

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

      // Re-anchor badges for annotations already saved on this page.
      void loadAndRenderBadges();
    }

    function deactivate() {
      if (!active) return;
      active = false;
      overlay.setModeActive(false);
      setCursorMode(false);
      if (highlighter) {
        highlighter.hide();
        highlighter = null;
      }
      document.removeEventListener('mouseover', onMouseOver, true);
      document.removeEventListener('mouseout', onMouseOut, true);
      document.removeEventListener('click', onClick, true);
      for (const type of BLOCKED_EVENTS) {
        document.removeEventListener(type, blockEvent, true);
      }
      if (escHandler) {
        document.removeEventListener('keydown', escHandler, true);
        escHandler = null;
      }
      resetPickSession();
      scrollCleanup?.();
      scrollCleanup = null;
      // Keep the review layer mounted if there are still badges to show; otherwise clean up.
      if (!overlay.hasBadges()) overlay.unmount();
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
            if (el) flashHighlight(el);
          } catch {
            /* invalid selector */
          }
        }
      },
    );

    // Keep the on-page review layer reactive: any add/delete/clear to this page's annotations
    // (from the side panel, the background, or another tab) redraws the badges immediately.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const change = changes[getStorageKey(pageUrl())];
      if (!change) return;
      const next = (change.newValue as { annotations?: FixItAnnotation[] } | undefined)?.annotations;
      renderBadges(next ?? []);
    });

    // SPA route changes don't reload the content script, so the badge layer must follow them.
    let lastUrl = pageUrl();
    const onRouteChange = () => {
      const next = pageUrl();
      if (next === lastUrl) return;
      lastUrl = next;
      sequenceIndex = 0;
      void loadAndRenderBadges();
    };
    for (const method of ['pushState', 'replaceState'] as const) {
      const original = history[method];
      history[method] = function (this: History, ...args: Parameters<History['pushState']>) {
        const result = original.apply(this, args);
        window.dispatchEvent(new Event('fixit:locationchange'));
        return result;
      };
    }
    window.addEventListener('popstate', onRouteChange);
    window.addEventListener('fixit:locationchange', onRouteChange);

    // Custom hotkey listener — registered once for the script's lifetime, independent of
    // annotation mode. It asks the background to toggle so state stays authoritative there.
    if (settings.customHotkey) {
      const hotkeyHandler = (e: KeyboardEvent) => {
        const parts: string[] = [];
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.altKey) parts.push('Alt');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');
        if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
          parts.push(e.key.toUpperCase());
        }
        if (parts.join('+') === settings.customHotkey) {
          e.preventDefault();
          sendMessageSafe({ type: MessageType.REQUEST_TOGGLE });
        }
      };
      document.addEventListener('keydown', hotkeyHandler);
    }

    // Draw the review layer on initial load (badges visible without entering annotation mode).
    void loadAndRenderBadges();
  },
});
