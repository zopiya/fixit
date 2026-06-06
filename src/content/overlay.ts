const STYLES = `
  :host { all: initial; --fixit-accent: #3B82F6; --fixit-radius: 14px; }
  [data-fixit="bubble"] {
    position: fixed;
    z-index: 2147483647;
    background: #ffffff;
    border: none;
    border-radius: var(--fixit-radius);
    box-shadow: 0 20px 60px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06);
    padding: 18px;
    min-width: 300px;
    max-width: 400px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
    animation: fixit-bubble-in 0.12s ease-out;
  }
  @keyframes fixit-bubble-in {
    from { opacity: 0; transform: translateY(4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  [data-fixit="bubble"] textarea {
    width: 100%;
    min-height: 80px;
    border: 1.5px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
    color: #1e293b;
    background: #f8fafc;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  [data-fixit="bubble"] textarea:focus {
    border-color: var(--fixit-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--fixit-accent) 12%, transparent);
    background: #fff;
  }
  [data-fixit="bubble"] textarea::placeholder {
    color: #94a3b8;
  }
  [data-fixit="bubble-add"] {
    display: block;
    width: 100%;
    margin-top: 8px;
    padding: 7px 0;
    border: none;
    border-radius: 8px;
    background: var(--fixit-accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: all 0.12s;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--fixit-accent) 25%, transparent);
  }
  [data-fixit="bubble-add"]:hover {
    filter: brightness(0.92);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px color-mix(in srgb, var(--fixit-accent) 35%, transparent);
  }
  [data-fixit="bubble-hint"] {
    margin-top: 6px;
    font-size: 11px;
    color: #94a3b8;
    text-align: center;
    letter-spacing: 0.4px;
  }
  [data-fixit^="badge"] {
    position: fixed;
    z-index: 2147483647;
    min-width: 24px;
    height: 24px;
    padding: 0 6px;
    border-radius: 12px;
    background: var(--fixit-accent);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    line-height: 24px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    cursor: pointer;
    user-select: none;
    box-shadow: 0 3px 10px color-mix(in srgb, var(--fixit-accent) 35%, transparent);
    transition: transform 0.12s ease-out, box-shadow 0.12s ease-out;
  }
  [data-fixit^="badge"]:hover {
    transform: scale(1.12);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--fixit-accent) 45%, transparent);
  }
  [data-fixit^="badge"][data-disconnected="true"] {
    background: #94a3b8;
    box-shadow: 0 2px 6px rgba(148,163,184,0.25);
    opacity: 0.7;
  }
`;

import { circledNumber } from '../shared/utils';
import { t } from '../shared/i18n';
import { getSettings } from '../shared/settings';

export class AnnotationOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private badges = new Map<number, HTMLElement>();
  private badgeElements = new Map<number, Element>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickStopHandler: ((e: Event) => void) | null = null;

  onConfirm: ((comment: string) => void) | null = null;
  onCancel: (() => void) | null = null;
  onBadgeClick: ((index: number) => void) | null = null;

  activate(): void {
    if (this.host) return;

    this.host = document.createElement('fixit-overlay');
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    this.clickStopHandler = (e: Event) => e.stopPropagation();
    this.shadow.addEventListener('click', this.clickStopHandler, { capture: true });

    document.documentElement.appendChild(this.host);

    // Load settings and apply as CSS custom properties
    getSettings().then((s) => {
      if (this.shadow) {
        const host = this.shadow.host as HTMLElement;
        host.style.setProperty('--fixit-accent', s.highlightColor);
        host.style.setProperty('--fixit-radius', `${s.bubbleBorderRadius}px`);
      }
    });
  }

  deactivate(): void {
    if (!this.host) return;
    this.host.remove();
    this.host = null;
    this.shadow = null;
    this.badges.clear();
    this.badgeElements.clear();
    this.keydownHandler = null;
    this.clickStopHandler = null;
  }

  showBubble(element: Element, position: { x: number; y: number }): void {
    if (!this.shadow) return;
    this.hideBubble();

    const bubble = document.createElement('div');
    bubble.setAttribute('data-fixit', 'bubble');
    bubble.style.left = `${position.x}px`;
    bubble.style.top = `${position.y}px`;

    const textarea = document.createElement('textarea');
    textarea.setAttribute('placeholder', t('bubble.placeholder'));
    bubble.appendChild(textarea);

    // Single add button
    const addBtn = document.createElement('button');
    addBtn.setAttribute('data-fixit', 'bubble-add');
    addBtn.textContent = t('bubble.add');
    addBtn.addEventListener('click', () => {
      const value = textarea.value.trim();
      if (value && this.onConfirm) {
        this.onConfirm(value);
      }
    });
    bubble.appendChild(addBtn);

    const hint = document.createElement('div');
    hint.setAttribute('data-fixit', 'bubble-hint');
    hint.textContent = t('bubble.hint');
    bubble.appendChild(hint);

    this.shadow.appendChild(bubble);
    textarea.focus();

    // Keyboard shortcuts
    this.keydownHandler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const value = textarea.value.trim();
        if (value && this.onConfirm) {
          this.onConfirm(value);
        }
      } else if (e.key === 'Escape') {
        if (this.onCancel) {
          this.onCancel();
        }
      }
    };
    textarea.addEventListener('keydown', this.keydownHandler);
  }

  hideBubble(): void {
    if (!this.shadow) return;
    const bubble = this.shadow.querySelector('[data-fixit="bubble"]');
    if (bubble) {
      bubble.remove();
    }
    this.keydownHandler = null;
  }

  addBadge(
    element: Element,
    index: number,
    meta?: { comment?: string; cssSelector?: string },
  ): void {
    if (!this.shadow) return;

    const badge = document.createElement('div');
    badge.setAttribute('data-fixit', `badge-${index}`);
    badge.textContent = circledNumber(index);
    badge.style.cursor = 'pointer';

    const comment = meta?.comment || 'No comment';
    const selector = meta?.cssSelector || '';
    badge.title = `#${index}: ${comment}\n${selector}`;

    badge.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onBadgeClick?.(index);
    });

    const rect = element.getBoundingClientRect();
    badge.style.top = `${rect.top - 11}px`;
    badge.style.left = `${rect.left + rect.width - 11}px`;

    this.shadow.appendChild(badge);
    this.badges.set(index, badge);
    this.badgeElements.set(index, element);
  }

  removeBadge(index: number): void {
    const badge = this.badges.get(index);
    if (badge) {
      badge.remove();
      this.badges.delete(index);
      this.badgeElements.delete(index);
    }
  }

  markDisconnected(index: number): void {
    const badge = this.badges.get(index);
    if (badge) {
      badge.setAttribute('data-disconnected', 'true');
    }
  }

  updateBadgePositions(): void {
    for (const [index, badge] of this.badges) {
      const element = this.badgeElements.get(index);
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      badge.style.top = `${rect.top - 11}px`;
      badge.style.left = `${rect.left + rect.width - 11}px`;
    }
  }

  getShadowRoot(): ShadowRoot | null {
    return this.shadow;
  }

  destroy(): void {
    this.deactivate();
  }
}
