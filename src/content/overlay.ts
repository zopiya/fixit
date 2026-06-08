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
  [data-fixit="crumbs"] {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 10px;
    max-height: 56px;
    overflow-y: auto;
  }
  [data-fixit="crumb"] {
    padding: 3px 8px;
    border-radius: 6px;
    border: none;
    background: #f1f5f9;
    color: #64748b;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 11px;
    line-height: 1.4;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s, color 0.12s;
  }
  [data-fixit="crumb"]:hover {
    background: #e2e8f0;
    color: #334155;
  }
  [data-fixit="crumb"][data-active="true"] {
    background: color-mix(in srgb, var(--fixit-accent) 14%, transparent);
    color: var(--fixit-accent);
    font-weight: 600;
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
  [data-fixit="banner"] {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 2147483647;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    border-radius: 9999px;
    background: rgba(15, 23, 42, 0.92);
    color: #fff;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    box-shadow: 0 8px 24px rgba(0,0,0,0.18);
    pointer-events: none;
    animation: fixit-banner-in 0.18s ease-out;
  }
  [data-fixit="banner"]::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--fixit-accent);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--fixit-accent) 30%, transparent);
    animation: fixit-pulse 1.4s ease-in-out infinite;
  }
  @keyframes fixit-banner-in {
    from { opacity: 0; transform: translate(-50%, -8px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes fixit-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

import { circledNumber } from '../shared/utils';
import { t } from '../shared/i18n';
import { getSettings } from '../shared/settings';

export class AnnotationOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private banner: HTMLElement | null = null;
  private badges = new Map<number, HTMLElement>();
  private badgeElements = new Map<number, Element>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickStopHandler: ((e: Event) => void) | null = null;

  onConfirm: ((comment: string) => void) | null = null;
  onCancel: (() => void) | null = null;
  onBadgeClick: ((index: number) => void) | null = null;

  /**
   * Create the isolated Shadow DOM host. Idempotent. Badges live here independently of
   * annotation mode, so the host can be mounted purely to display a read-only review layer.
   */
  mount(): void {
    if (this.host) return;

    this.host = document.createElement('fixit-overlay');
    this.shadow = this.host.attachShadow({ mode: 'closed' });

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    // Stop clicks inside our UI from escaping to the page (bubble phase, so the overlay's
    // own controls — chips, buttons — still receive the click first).
    this.clickStopHandler = (e: Event) => e.stopPropagation();
    this.shadow.addEventListener('click', this.clickStopHandler);

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

  unmount(): void {
    if (!this.host) return;
    this.host.remove();
    this.host = null;
    this.shadow = null;
    this.banner = null;
    this.badges.clear();
    this.badgeElements.clear();
    this.keydownHandler = null;
    this.clickStopHandler = null;
  }

  isMounted(): boolean {
    return !!this.host;
  }

  hasBadges(): boolean {
    return this.badges.size > 0;
  }

  /** Toggle the in-page "annotation mode" banner. Mounts the host if needed. */
  setModeActive(active: boolean): void {
    if (active) {
      this.mount();
      if (this.shadow && !this.banner) {
        const banner = document.createElement('div');
        banner.setAttribute('data-fixit', 'banner');
        banner.textContent = t('mode.banner');
        this.shadow.appendChild(banner);
        this.banner = banner;
      }
    } else if (this.banner) {
      this.banner.remove();
      this.banner = null;
    }
  }

  /** Backwards-compatible convenience: mount + enter mode. */
  activate(): void {
    this.setModeActive(true);
  }

  /** Backwards-compatible convenience: leave mode + tear everything down. */
  deactivate(): void {
    this.setModeActive(false);
    this.unmount();
  }

  showBubble(
    element: Element,
    position: { x: number; y: number },
    opts?: {
      comment?: string;
      crumbs?: string[];
      activeCrumb?: number;
      onPickCrumb?: (index: number) => void;
      submitMode?: 'mod-enter' | 'enter';
    },
  ): void {
    this.mount();
    if (!this.shadow) return;
    this.hideBubble();

    const submitMode = opts?.submitMode ?? 'enter';

    const bubble = document.createElement('div');
    bubble.setAttribute('data-fixit', 'bubble');
    bubble.style.left = `${position.x}px`;
    bubble.style.top = `${position.y}px`;
    bubble.style.visibility = 'hidden';

    // Breadcrumb of the candidate element's ancestor chain — lets the user adjust which
    // element is targeted (the deepest hit is often an inner <span>/<svg>, not the button).
    if (opts?.crumbs && opts.crumbs.length > 0) {
      const crumbs = document.createElement('div');
      crumbs.setAttribute('data-fixit', 'crumbs');
      opts.crumbs.forEach((label, i) => {
        const chip = document.createElement('button');
        chip.setAttribute('data-fixit', 'crumb');
        chip.setAttribute('data-crumb-index', String(i));
        if (i === opts.activeCrumb) chip.setAttribute('data-active', 'true');
        chip.textContent = label;
        chip.addEventListener('click', (e) => {
          e.stopPropagation();
          opts.onPickCrumb?.(i);
        });
        crumbs.appendChild(chip);
      });
      bubble.appendChild(crumbs);
    }

    const textarea = document.createElement('textarea');
    textarea.setAttribute('placeholder', t('bubble.placeholder'));
    if (opts?.comment) textarea.value = opts.comment;
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
    hint.textContent = submitMode === 'mod-enter' ? t('bubble.hintMod') : t('bubble.hintEnter');
    bubble.appendChild(hint);

    this.shadow.appendChild(bubble);

    // Clamp into the viewport now that the bubble has measurable dimensions, so it never
    // renders partly off-screen near page edges. Falls back to nominal sizes in jsdom.
    const margin = 8;
    const width = bubble.offsetWidth || 320;
    const height = bubble.offsetHeight || 160;
    let left = position.x;
    let top = position.y;
    if (left + width + margin > window.innerWidth) left = window.innerWidth - width - margin;
    if (left < margin) left = margin;
    if (top + height + margin > window.innerHeight) top = position.y - height - margin;
    if (top < margin) top = margin;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${top}px`;
    bubble.style.visibility = 'visible';

    textarea.focus();

    const submit = () => {
      const value = textarea.value.trim();
      if (value && this.onConfirm) this.onConfirm(value);
    };

    // Keyboard shortcuts
    this.keydownHandler = (e: KeyboardEvent) => {
      // Ignore keystrokes that belong to an active IME composition (e.g. pressing Enter to
      // pick a Chinese/Japanese candidate) — otherwise it would submit a half-typed comment.
      if (e.isComposing || e.keyCode === 229) return;

      if (e.key === 'Escape') {
        this.onCancel?.();
        return;
      }
      if (e.key !== 'Enter') return;

      if (submitMode === 'mod-enter') {
        // ⌘/Ctrl+Enter submits; a bare Enter inserts a newline.
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault();
          submit();
        }
      } else {
        // Enter submits; Shift+Enter inserts a newline.
        if (!e.shiftKey) {
          e.preventDefault();
          submit();
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

  /** Highlight the active crumb after the candidate element changes (keyboard/click). */
  setBreadcrumbActive(index: number): void {
    if (!this.shadow) return;
    const chips = this.shadow.querySelectorAll('[data-fixit="crumb"]');
    chips.forEach((chip) => {
      const i = Number(chip.getAttribute('data-crumb-index'));
      if (i === index) chip.setAttribute('data-active', 'true');
      else chip.removeAttribute('data-active');
    });
  }

  addBadge(
    element: Element,
    index: number,
    meta?: { comment?: string; cssSelector?: string },
  ): void {
    this.mount();
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

  /** Remove every badge (used before re-rendering the review layer from storage). */
  clearBadges(): void {
    for (const badge of this.badges.values()) badge.remove();
    this.badges.clear();
    this.badgeElements.clear();
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
