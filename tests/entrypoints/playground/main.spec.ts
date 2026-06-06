import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock chrome API — hoisted so it's available before module import
const { messageListeners, chromeMock } = vi.hoisted(() => {
  const messageListeners: Array<(msg: unknown) => void> = [];
  const chromeMock = {
    runtime: {
      onMessage: {
        addListener: vi.fn((fn: (msg: unknown) => void) => {
          messageListeners.push(fn);
        }),
      },
    },
  };
  return { messageListeners, chromeMock };
});

vi.stubGlobal('chrome', chromeMock);

import { completeStep, showCompletion, completedSteps, setupBugDetection } from '../../../entrypoints/playground/main';

beforeEach(() => {
  completedSteps.clear();
  messageListeners.length = 0;
  vi.clearAllMocks();

  document.body.innerHTML = `
    <div class="task-item active" data-task="1">
      <div class="task-number">1</div>
      <div><div class="task-label">Task 1</div></div>
    </div>
    <div class="task-item" data-task="2">
      <div class="task-number">2</div>
      <div><div class="task-label">Task 2</div></div>
    </div>
    <div class="task-item" data-task="3">
      <div class="task-number">3</div>
      <div><div class="task-label">Task 3</div></div>
    </div>
    <div class="completion-overlay" id="completion-overlay">
      <div class="fireworks" id="fireworks"></div>
    </div>
  `;

  setupBugDetection();
});

describe('playground step tracking', () => {
  it('marks a step as completed', () => {
    completeStep(1);
    const item = document.querySelector('.task-item[data-task="1"]');
    expect(item?.classList.contains('completed')).toBe(true);
  });

  it('activates the next step after completing current', () => {
    completeStep(1);
    const next = document.querySelector('.task-item[data-task="2"]');
    expect(next?.classList.contains('active')).toBe(true);
  });

  it('does not double-complete a step', () => {
    completeStep(1);
    completeStep(1);
    expect(completedSteps.size).toBe(1);
  });

  it('removes active class when step is completed', () => {
    completeStep(1);
    const item = document.querySelector('.task-item[data-task="1"]');
    expect(item?.classList.contains('active')).toBe(false);
  });

  it('keeps step 3 inactive until step 2 is done', () => {
    completeStep(1);
    const step3 = document.querySelector('.task-item[data-task="3"]');
    expect(step3?.classList.contains('active')).toBe(false);
  });
});

describe('playground completion', () => {
  it('shows completion overlay after all 3 steps', () => {
    completeStep(1);
    completeStep(2);
    completeStep(3);

    const overlay = document.getElementById('completion-overlay');
    expect(overlay?.classList.contains('visible')).toBe(true);
  });

  it('does not show overlay before all steps are done', () => {
    completeStep(1);
    completeStep(2);

    const overlay = document.getElementById('completion-overlay');
    expect(overlay?.classList.contains('visible')).toBe(false);
  });

  it('creates firework particles on completion', () => {
    showCompletion();

    const fireworks = document.getElementById('fireworks');
    const particles = fireworks?.querySelectorAll('.particle');
    expect(particles?.length).toBeGreaterThan(0);
  });

  it('creates burst groups for staggered animation', () => {
    showCompletion();

    const fireworks = document.getElementById('fireworks');
    const groups = fireworks?.querySelectorAll('.burst-group');
    expect(groups?.length).toBe(5);
  });
});

describe('playground firework animation', () => {
  it('particle elements have custom CSS variables for direction', () => {
    showCompletion();

    const fireworks = document.getElementById('fireworks');
    const particle = fireworks?.querySelector('.particle') as HTMLElement;
    expect(particle?.style.getPropertyValue('--tx')).toBeTruthy();
    expect(particle?.style.getPropertyValue('--ty')).toBeTruthy();
  });

  it('particles have different background colors', () => {
    showCompletion();

    const fireworks = document.getElementById('fireworks');
    const particles = fireworks?.querySelectorAll('.particle');
    const colors = new Set<string>();
    particles?.forEach((p) => {
      colors.add((p as HTMLElement).style.background);
    });
    expect(colors.size).toBeGreaterThan(1);
  });
});

describe('playground chrome message listener', () => {
  it('registers a message listener for ADD_ANNOTATION', () => {
    expect(chromeMock.runtime.onMessage.addListener).toHaveBeenCalled();
  });

  it('completes all steps when ADD_ANNOTATION message is received', () => {
    for (const listener of messageListeners) {
      listener({
        type: 'ADD_ANNOTATION',
        payload: { userComment: 'Fix this button' },
      });
    }

    expect(completedSteps.size).toBe(3);
  });
});

describe('playground bug click detection', () => {
  it('completes step 1 when misaligned button is clicked', () => {
    const btn = document.createElement('button');
    btn.setAttribute('data-bug', 'misaligned-btn');
    document.body.appendChild(btn);

    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(completedSteps.has(1)).toBe(true);
  });

  it('completes step 2 when wrong color text is clicked', () => {
    const text = document.createElement('p');
    text.setAttribute('data-bug', 'wrong-color-text');
    document.body.appendChild(text);

    text.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(completedSteps.has(2)).toBe(true);
  });

  it('completes step 3 when broken layout card is clicked', () => {
    const card = document.createElement('div');
    card.setAttribute('data-bug', 'broken-layout');
    document.body.appendChild(card);

    card.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(completedSteps.has(3)).toBe(true);
  });
});
