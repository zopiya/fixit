const STYLES = `
  :host { all: initial; }
  [data-fixit="bubble"] {
    position: fixed;
    z-index: 2147483647;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    padding: 12px;
    min-width: 260px;
    max-width: 360px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }
  [data-fixit="bubble"] textarea {
    width: 100%;
    min-height: 60px;
    border: 1px solid #d1d5db;
    border-radius: 4px;
    padding: 8px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    outline: none;
    box-sizing: border-box;
  }
  [data-fixit="bubble"] textarea:focus {
    border-color: #3B82F6;
  }
  [data-fixit="bubble-hint"] {
    margin-top: 6px;
    font-size: 12px;
    color: #9ca3af;
  }
  [data-fixit^="badge"] {
    position: fixed;
    z-index: 2147483647;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #3B82F6;
    color: #fff;
    font-size: 13px;
    line-height: 22px;
    text-align: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
    user-select: none;
  }
  [data-fixit^="badge"][data-disconnected="true"] {
    background: #9ca3af;
    opacity: 0.7;
  }
`;

const CIRCLED = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                 '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];

function circledNumber(n: number): string {
  return CIRCLED[n - 1] ?? `(${n})`;
}

export class AnnotationOverlay {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private badges = new Map<number, HTMLElement>();
  private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
  private clickStopHandler: ((e: Event) => void) | null = null;

  onConfirm: ((comment: string) => void) | null = null;
  onCancel: (() => void) | null = null;

  activate(): void {
    if (this.host) return;

    this.host = document.createElement('fixit-overlay');
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    // Store reference for testing (closed shadow is not accessible via host.shadowRoot)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.host as any).__fixitShadow = this.shadow;

    const style = document.createElement('style');
    style.textContent = STYLES;
    this.shadow.appendChild(style);

    this.clickStopHandler = (e: Event) => e.stopPropagation();
    this.shadow.addEventListener('click', this.clickStopHandler, { capture: true });

    document.documentElement.appendChild(this.host);
  }

  deactivate(): void {
    if (!this.host) return;
    this.host.remove();
    this.host = null;
    this.shadow = null;
    this.badges.clear();
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
    textarea.setAttribute('placeholder', '描述需要修改的内容…');
    bubble.appendChild(textarea);

    const hint = document.createElement('div');
    hint.setAttribute('data-fixit', 'bubble-hint');
    hint.textContent = 'Enter 确认 · Esc 取消';
    bubble.appendChild(hint);

    this.shadow.appendChild(bubble);

    textarea.focus();

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

  addBadge(element: Element, index: number): void {
    if (!this.shadow) return;

    const badge = document.createElement('div');
    badge.setAttribute('data-fixit', `badge-${index}`);
    badge.textContent = circledNumber(index);

    const rect = element.getBoundingClientRect();
    badge.style.top = `${rect.top - 11}px`;
    badge.style.left = `${rect.left + rect.width - 11}px`;

    this.shadow.appendChild(badge);
    this.badges.set(index, badge);
  }

  removeBadge(index: number): void {
    const badge = this.badges.get(index);
    if (badge) {
      badge.remove();
      this.badges.delete(index);
    }
  }

  markDisconnected(index: number): void {
    const badge = this.badges.get(index);
    if (badge) {
      badge.setAttribute('data-disconnected', 'true');
    }
  }

  destroy(): void {
    this.deactivate();
  }
}
