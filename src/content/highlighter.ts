export class Highlighter {
  private container: ShadowRoot;
  private overlay: HTMLElement | null = null;

  constructor(container: ShadowRoot) {
    this.container = container;
  }

  show(element: Element): void {
    if (!this.overlay) {
      this.overlay = document.createElement('div');
      this.overlay.setAttribute('data-fixit', 'highlight');
      this.overlay.style.position = 'fixed';
      this.overlay.style.pointerEvents = 'none';
      this.overlay.style.boxSizing = 'border-box';
      this.overlay.style.zIndex = '2147483646';
      this.overlay.style.borderRadius = '2px';
      this.overlay.style.border = '2px solid #3B82F6';
      this.container.appendChild(this.overlay);
    }

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
