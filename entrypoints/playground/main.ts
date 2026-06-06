/**
 * FixIt Playground — Onboarding page with intentional UI bugs.
 * Tracks 3 guided tasks and fires a CSS firework animation on completion.
 */

const completedSteps = new Set<number>();

/** Mark a task step as completed in the sidebar. */
function completeStep(step: number): void {
  if (completedSteps.has(step)) return;
  completedSteps.add(step);

  const item = document.querySelector(`.task-item[data-task="${step}"]`);
  if (item) {
    item.classList.remove('active');
    item.classList.add('completed');
  }

  // Activate the next step
  const next = step + 1;
  if (next <= 3) {
    const nextItem = document.querySelector(`.task-item[data-task="${next}"]`);
    if (nextItem) nextItem.classList.add('active');
  }

  if (completedSteps.size === 3) {
    showCompletion();
  }
}

/** Create a burst of CSS particles at a given position. */
function createBurst(container: HTMLElement, x: string, y: string, delay: number): void {
  const group = document.createElement('div');
  group.className = 'burst-group';
  group.style.left = x;
  group.style.top = y;
  group.style.animationDelay = `${delay}s`;

  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  for (let i = 0; i < 12; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 12) * 2 * Math.PI;
    const dist = 60 + Math.random() * 60;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    p.style.setProperty('--tx', `${tx}px`);
    p.style.setProperty('--ty', `${ty}px`);
    p.style.background = colors[i % colors.length];
    group.appendChild(p);
  }

  container.appendChild(group);
}

/** Show the completion overlay with firework animation. */
function showCompletion(): void {
  const overlay = document.getElementById('completion-overlay');
  const fireworks = document.getElementById('fireworks');
  if (!overlay || !fireworks) return;

  overlay.classList.add('visible');

  // Launch several bursts with staggered timing
  const positions = [
    { x: '20%', y: '30%', delay: 0.2 },
    { x: '70%', y: '20%', delay: 0.6 },
    { x: '45%', y: '45%', delay: 1.0 },
    { x: '80%', y: '50%', delay: 1.4 },
    { x: '15%', y: '55%', delay: 1.8 },
  ];

  for (const pos of positions) {
    createBurst(fireworks, pos.x, pos.y, pos.delay);
  }
}

/**
 * Listen for annotation events from the content script.
 * In the real extension, the content script sends ADD_ANNOTATION messages.
 * For the playground, we intercept clicks on bug elements to simulate task completion.
 */
function setupBugDetection(): void {
  // Listen for clicks on buggy elements (when FixIt is active, these become annotations)
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Walk up to find a bug target
    const bugEl = target.closest('[data-bug]') as HTMLElement | null;
    if (!bugEl) return;

    const bugType = bugEl.getAttribute('data-bug');
    if (!bugType) return;

    // Map bug type to step number
    const stepMap: Record<string, number> = {
      'misaligned-btn': 1,
      'wrong-color-text': 2,
      'broken-layout': 3,
      'card-ok': 3, // clicking either card counts for step 3
    };

    const step = stepMap[bugType];
    if (step) {
      completeStep(step);
    }
  }, true);

  // Also listen for custom event from content script (when annotation is confirmed)
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(
      (msg: { type: string; payload?: { userComment?: string; url?: string } }) => {
        if (msg.type === 'ADD_ANNOTATION' && msg.payload?.userComment) {
          completeStep(1);
          completeStep(2);
          completeStep(3);
        }
      },
    );
  }
}

// Auto-init
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupBugDetection);
  } else {
    setupBugDetection();
  }
}

export { completeStep, showCompletion, completedSteps, setupBugDetection };
