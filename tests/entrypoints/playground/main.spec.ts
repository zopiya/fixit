import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API
vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: vi.fn(),
  },
  tabs: {
    query: vi.fn(),
  },
  sidePanel: {
    open: vi.fn(),
  },
});

// Mock crypto.randomUUID
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid'),
});

// Mock locator modules
vi.mock('../../src/content/locator/css-selector', () => ({
  generateCssSelector: vi.fn(() => ({ selector: '#test', confidence: 'id' })),
}));

vi.mock('../../src/content/locator/xpath', () => ({
  generateXPath: vi.fn(() => ({ xpath: 'id("test")' })),
}));

// Mock i18n
vi.mock('../../src/shared/i18n', () => ({
  t: (key: string) => {
    const map: Record<string, string> = {
      'playground.welcome': 'Welcome to FixIt Playground',
      'playground.intro': 'Master FixIt in three simple tasks',
      'playground.start': 'Start',
      'playground.task1.desc': 'Click the misaligned button',
      'playground.task1.hint': 'Click the red button',
      'playground.task2.desc': 'Find the wrong color text',
      'playground.task2.hint': 'The lime-green text is hard to read',
      'playground.task3.desc': 'Annotate the broken layout',
      'playground.task3.hint': 'One card is misaligned',
      'playground.complete.title': 'Congratulations!',
      'playground.complete.desc': "You've mastered FixIt",
      'playground.complete.hint': 'Now use FixIt on any page',
      'playground.restart': 'Start Over',
      'playground.btn.submit': 'Submit Order',
      'playground.wrong.text': 'This text color is wrong',
      'playground.activateBtn': 'Click to annotate',
      'playground.workOrder': 'Work Order Preview',
      'playground.noAnnotations': 'No annotations yet',
      'bubble.placeholder': 'Describe the issue…',
      'bubble.add': 'Add',
      'sidepanel.copy': 'Copy',
      'sidepanel.copied': 'Copied!',
    };
    return map[key] ?? key;
  },
  setLocale: vi.fn(),
  detectLocaleAsync: vi.fn(async () => 'en'),
}));

// Mock exporter
vi.mock('../../../entrypoints/sidepanel/exporter', () => ({
  exportToMarkdown: vi.fn(async () => '# Work Order'),
}));

import { renderStep } from '../../../entrypoints/playground/main';

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '<div id="step-container"></div>';
});

describe('playground wizard', () => {
  describe('renderStep("welcome")', () => {
    it('renders welcome screen with start button', () => {
      renderStep('welcome');
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('#start-btn')).toBeTruthy();
      expect(container.textContent).toContain('Welcome to FixIt Playground');
    });

    it('navigates to bug1 when start is clicked', () => {
      renderStep('welcome');
      document.getElementById('start-btn')!.click();
      const container = document.getElementById('step-container')!;
      expect(container.textContent).toContain('Click the misaligned button');
    });
  });

  describe('renderStep("bug1")', () => {
    it('renders bug1 step with misaligned button', () => {
      renderStep('bug1');
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('[data-bug="misaligned-btn"]')).toBeTruthy();
      expect(container.textContent).toContain('Submit Order');
    });

    it('renders back button that goes to welcome', () => {
      renderStep('bug1');
      document.getElementById('back-btn')!.click();
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('#start-btn')).toBeTruthy();
    });
  });

  describe('renderStep("bug2")', () => {
    it('renders bug2 step with wrong color text', () => {
      renderStep('bug2');
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('[data-bug="wrong-color-text"]')).toBeTruthy();
    });

    it('renders back button that goes to bug1', () => {
      renderStep('bug2');
      document.getElementById('back-btn')!.click();
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('[data-bug="misaligned-btn"]')).toBeTruthy();
    });
  });

  describe('renderStep("bug3")', () => {
    it('renders bug3 step with broken layout cards', () => {
      renderStep('bug3');
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('[data-bug="broken-layout"]')).toBeTruthy();
      expect(container.querySelector('[data-bug="card-ok"]')).toBeTruthy();
    });

    it('renders back button that goes to bug2', () => {
      renderStep('bug3');
      document.getElementById('back-btn')!.click();
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('[data-bug="wrong-color-text"]')).toBeTruthy();
    });
  });

  describe('renderStep("done")', () => {
    it('renders congratulations screen', () => {
      renderStep('done');
      const container = document.getElementById('step-container')!;
      expect(container.textContent).toContain('Congratulations!');
      expect(container.querySelector('#restart-btn')).toBeTruthy();
    });

    it('renders work order preview', () => {
      renderStep('done');
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('#work-order-content')).toBeTruthy();
      expect(container.querySelector('#copy-work-order')).toBeTruthy();
    });

    it('restart button goes back to welcome', () => {
      renderStep('done');
      document.getElementById('restart-btn')!.click();
      const container = document.getElementById('step-container')!;
      expect(container.querySelector('#start-btn')).toBeTruthy();
    });
  });
});

describe('annotation creation flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '<div id="step-container"></div>';
  });

  it('clicking a bug element shows the bubble', () => {
    // Must go through welcome → start to set annotationMode = true
    renderStep('welcome');
    document.getElementById('start-btn')!.click();
    // Now on bug1 with annotationMode = true

    const container = document.getElementById('step-container')!;
    const bugEl = container.querySelector('[data-bug="misaligned-btn"]') as HTMLElement;
    bugEl.click();

    const bubble = document.querySelector('.fixit-bubble');
    expect(bubble).toBeTruthy();
    const textarea = bubble!.querySelector('textarea');
    expect(textarea).toBeTruthy();
  });

  it('entering text and clicking "添加" creates annotation and sends ADD_ANNOTATION', async () => {
    renderStep('welcome');
    document.getElementById('start-btn')!.click();

    const container = document.getElementById('step-container')!;
    const bugEl = container.querySelector('[data-bug="misaligned-btn"]') as HTMLElement;
    bugEl.click();

    const bubble = document.querySelector('.fixit-bubble')!;
    const textarea = bubble.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Button is misaligned';

    const addBtn = bubble.querySelector('.fixit-bubble-add') as HTMLButtonElement;
    addBtn.click();

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_ANNOTATION',
          payload: expect.objectContaining({
            userComment: 'Button is misaligned',
          }),
        }),
      );
    });
  });

  it('Ctrl/Cmd+Enter creates an annotation (default submit shortcut); plain Enter does not', async () => {
    renderStep('welcome');
    document.getElementById('start-btn')!.click();

    const container = document.getElementById('step-container')!;
    const bugEl = container.querySelector('[data-bug="misaligned-btn"]') as HTMLElement;
    bugEl.click();

    const bubble = document.querySelector('.fixit-bubble')!;
    const textarea = bubble.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'Wrong alignment';

    // Plain Enter must NOT submit under the default mod-enter mode (lets users type freely).
    textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();

    // Ctrl+Enter submits.
    textarea.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }),
    );

    await vi.waitFor(() => {
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ADD_ANNOTATION',
          payload: expect.objectContaining({
            userComment: 'Wrong alignment',
          }),
        }),
      );
    });
  });

  it('does not create annotation with empty text', () => {
    renderStep('welcome');
    document.getElementById('start-btn')!.click();

    const container = document.getElementById('step-container')!;
    const bugEl = container.querySelector('[data-bug="misaligned-btn"]') as HTMLElement;
    bugEl.click();

    const bubble = document.querySelector('.fixit-bubble')!;
    const addBtn = bubble.querySelector('.fixit-bubble-add') as HTMLButtonElement;
    addBtn.click();

    expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
  });
});

describe('fireworks', () => {
  it('creates burst groups with particles', () => {
    // Render done first to create the fireworks container
    renderStep('done');
    const fireworks = document.getElementById('fireworks-container')!;
    const groups = fireworks.querySelectorAll('.burst-group');
    expect(groups.length).toBe(5);
    const particles = fireworks.querySelectorAll('.particle');
    expect(particles.length).toBe(70); // 5 groups * 14 particles
  });

  it('particles have CSS custom properties for direction', () => {
    renderStep('done');
    const fireworks = document.getElementById('fireworks-container')!;
    const particle = fireworks.querySelector('.particle') as HTMLElement;
    expect(particle.style.getPropertyValue('--tx')).toBeTruthy();
    expect(particle.style.getPropertyValue('--ty')).toBeTruthy();
  });
});
