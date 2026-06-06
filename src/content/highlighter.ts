import { getSettings } from '../shared/settings';

export class Highlighter {
  private container: ShadowRoot;
  private overlay: HTMLElement | null = null;
  private highlightColor = '#3B82F6';
  private highlightBorderWidth = 2;

  constructor(container: ShadowRoot) {
    this.container = container;
    getSettings().then((s) => {
      this.highlightColor = s.highlightColor;
      this.highlightBorderWidth = s.highlightBorderWidth;
    });
  }

  show(element: Element): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.setAttribute('data-fixit', 'highlight');
      this.overlay.style.position = 'fixed';
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.boxSizing = 'border-box';
      this.overlay.style.zIndex = '2147483646';
      this.overlay.style.borderRadius = '4px';
      this.container.appendChild(this.overlay);
    }

    const color = this.highlightColor;
    const width = this.highlightBorderWidth;
    this.overlay.style.borderRadius = '6px';
    this.overlay.style.border = `${width}px solid ${color}`;
    this.overlay.style.boxShadow = `0 0 0 ${width + 1}px ${color}20, 0 0 12px ${color}15`;

    const rect = element.getBoundingClientRect();
    this.overlay.style.top = `${rect.top}px`;
    this.overlay.style.left = `${rect.left}px`;
    this.overlay.style.width = `${rect.width}px`;
    this.overlay.style.height = `${rect.height}px`;
  }

  hide(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  destroy(): void {
    this.hide();
  }
}
