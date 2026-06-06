/**
 * FixIt Playground — 5-step onboarding wizard.
 * Flow: Welcome → Bug 1 → Bug 2 → Bug 3 → Congratulations
 * Self-contained: directly sends annotations to background script (no content script needed).
 */

import { t, setLocale, detectLocaleAsync } from '../../src/shared/i18n';
import { MessageType } from '../../src/shared/types';
import { generateCssSelector } from '../../src/content/locator/css-selector';
import { generateXPath } from '../../src/content/locator/xpath';
import { circledNumber } from '../../src/shared/utils';
import { exportToMarkdown } from '../sidepanel/exporter';
import type { FixItAnnotation } from '../../src/shared/types';

// ── Module-level state ──
let currentStep: 'welcome' | 'bug1' | 'bug2' | 'bug3' | 'done' = 'welcome';
let annotationMode = false;
let sequenceIndex = 0;
const annotations: FixItAnnotation[] = [];

// ── i18n ──
function applyI18n(): void {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translation = t(key);
      if (translation !== key) el.textContent = translation;
    }
  });
}

// ── Step rendering ──
function renderStep(step: typeof currentStep): void {
  currentStep = step;
  const container = document.getElementById('step-container');
  if (!container) return;
  container.innerHTML = '';

  switch (step) {
    case 'welcome': renderWelcome(container); break;
    case 'bug1': renderBugStep(container, 1); break;
    case 'bug2': renderBugStep(container, 2); break;
    case 'bug3': renderBugStep(container, 3); break;
    case 'done': renderDone(container); break;
  }
  applyI18n();
}

function renderWelcome(container: HTMLElement): void {
  container.innerHTML = `
    <div class="text-center max-w-lg">
      <div class="text-6xl mb-6">🔧</div>
      <h1 class="text-3xl font-bold text-slate-800 mb-4 tracking-tight" data-i18n="playground.welcome">欢迎来到 FixIt Playground</h1>
      <p class="text-base text-slate-500 leading-relaxed mb-8 max-w-md mx-auto" data-i18n="playground.intro">
        通过三个简单任务，快速掌握 FixIt 的使用方法
      </p>
      <button id="start-btn" class="px-8 py-3.5 bg-blue-500 text-white rounded-2xl text-base font-semibold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 active:translate-y-0">
        <span data-i18n="playground.start">开始</span> →
      </button>
    </div>
  `;
  document.getElementById('start-btn')?.addEventListener('click', () => {
    annotationMode = true;
    document.body.classList.add('fixit-annotation-mode');
    renderStep('bug1');
  });
}

function renderBugStep(container: HTMLElement, bugNum: number): void {
  const configs = {
    1: {
      titleKey: 'playground.task1.desc',
      titleDefault: '点击错位的按钮',
      hintKey: 'playground.task1.hint',
      hintDefault: '点击下方的红色按钮，描述问题',
      content: `<button class="misaligned-btn" data-bug="misaligned-btn" data-i18n="playground.btn.submit">提交订单</button>`,
      desc: '这是一个表单区域，提交按钮的位置明显偏移了：',
    },
    2: {
      titleKey: 'playground.task2.desc',
      titleDefault: '找到颜色错误的文本',
      hintKey: 'playground.task2.hint',
      hintDefault: '这段文字颜色太浅，标注它',
      content: `<p class="wrong-color-text" data-bug="wrong-color-text" data-i18n="playground.wrong.text">这段重要通知使用了刺眼的黄绿色，在浅色背景上几乎不可读。应该使用深灰或蓝色等可读性更好的颜色。</p>`,
      desc: '注意这段文字的颜色：',
    },
    3: {
      titleKey: 'playground.task3.desc',
      titleDefault: '标注布局问题',
      hintKey: 'playground.task3.hint',
      hintDefault: '其中一张卡片错位了，标注它',
      content: `<div class="broken-layout"><div class="card" data-bug="card-ok"><h3>功能卡片 A</h3><p>这张卡片在网格中正确对齐。</p></div><div class="card" data-bug="broken-layout"><h3>功能卡片 B</h3><p>这张卡片偏移并旋转了 — 明显的布局问题。</p></div></div>`,
      desc: '观察下面两张卡片的布局：',
    },
  };

  const cfg = configs[bugNum as keyof typeof configs];
  const stepNum = bugNum;

  container.innerHTML = `
    <div class="w-full max-w-2xl">
      <div class="flex items-center gap-3 mb-2">
        <div class="w-9 h-9 rounded-xl bg-blue-500 text-white text-sm font-bold flex items-center justify-center shadow-sm">${stepNum}</div>
        <h2 class="text-xl font-bold text-slate-800 tracking-tight" data-i18n="${cfg.titleKey}">${cfg.titleDefault}</h2>
      </div>
      <p class="text-sm text-slate-500 mb-6 ml-12" data-i18n="${cfg.hintKey}">${cfg.hintDefault}</p>
      <div class="bg-white rounded-2xl p-8 shadow-lg shadow-slate-200/50 border border-slate-100">
        <p class="text-sm text-slate-600 mb-5">${cfg.desc}</p>
        ${cfg.content}
      </div>
      <div class="mt-6 flex justify-between items-center">
        <button id="back-btn" class="px-4 py-2 text-sm text-slate-400 hover:text-slate-600 transition-colors">← 返回</button>
        <div class="flex items-center gap-2 text-sm text-slate-400">
          <span>${stepNum}</span><span>/</span><span>3</span>
        </div>
      </div>
    </div>
  `;

  document.getElementById('back-btn')?.addEventListener('click', () => {
    if (bugNum === 1) renderStep('welcome');
    else renderStep(`bug${bugNum - 1}` as typeof currentStep);
  });

  setupBugClickHandlers();
}

// ── Bug click handling (shared across all bug steps) ──
function setupBugClickHandlers(): void {
  document.querySelectorAll('[data-bug]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!annotationMode) return;
      e.preventDefault();
      e.stopPropagation();

      const target = e.currentTarget as Element;
      const cssResult = generateCssSelector(target);
      const xpathResult = generateXPath(target);
      sequenceIndex++;

      showInlineBubble(target, (comment: string) => {
        const annotation: FixItAnnotation = {
          id: crypto.randomUUID(),
          url: window.location.origin + window.location.pathname,
          fullUrl: window.location.href,
          cssSelector: cssResult.selector,
          cssSelectorConfidence: cssResult.confidence as FixItAnnotation['cssSelectorConfidence'],
          xpath: xpathResult.xpath,
          htmlSnapshot: target.outerHTML.slice(0, 500),
          userComment: comment,
          sequenceIndex,
          createdAt: Date.now(),
        };

        annotations.push(annotation);

        // Send to background
        chrome.runtime.sendMessage({
          type: MessageType.ADD_ANNOTATION,
          payload: annotation,
        });

        // Add badge (persistent)
        addBadge(target, sequenceIndex);

        // Open side panel on first annotation
        if (annotations.length === 1) {
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]?.id) {
              chrome.sidePanel.open({ tabId: tabs[0].id }).catch(() => {});
            }
          });
        }

        // Auto-advance after short delay
        const bugType = target.getAttribute('data-bug');
        setTimeout(() => {
          if (bugType === 'misaligned-btn') renderStep('bug2');
          else if (bugType === 'wrong-color-text') renderStep('bug3');
          else if (bugType === 'broken-layout' || bugType === 'card-ok') renderStep('done');
        }, 500);
      });
    });
  });
}

// ── Inline bubble (simplified: textarea + "添加" button only) ──
function showInlineBubble(el: Element, onConfirm: (comment: string) => void): void {
  document.querySelectorAll('.fixit-bubble').forEach((b) => b.remove());

  const rect = el.getBoundingClientRect();
  const bubble = document.createElement('div');
  bubble.className = 'fixit-bubble';

  // Position below element
  let top = rect.bottom + 12;
  let left = rect.left;
  if (top + 160 > window.innerHeight) top = rect.top - 160;
  if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
  bubble.style.top = `${Math.max(8, top)}px`;
  bubble.style.left = `${Math.max(8, left)}px`;

  const textarea = document.createElement('textarea');
  textarea.placeholder = t('bubble.placeholder') || '描述需要修改的内容…';
  bubble.appendChild(textarea);

  const addBtn = document.createElement('button');
  addBtn.className = 'fixit-bubble-add';
  addBtn.textContent = t('bubble.add') || '添加';
  addBtn.addEventListener('click', () => {
    const value = textarea.value.trim();
    if (value) {
      onConfirm(value);
      bubble.remove();
    }
  });
  bubble.appendChild(addBtn);

  document.body.appendChild(bubble);
  textarea.focus();

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const value = textarea.value.trim();
      if (value) {
        onConfirm(value);
        bubble.remove();
      }
    }
    if (e.key === 'Escape') {
      bubble.remove();
    }
  });
}

// ── Badge (persistent) ──
function addBadge(el: Element, index: number): void {
  const rect = el.getBoundingClientRect();
  const badge = document.createElement('div');
  badge.className = 'fixit-badge';
  badge.textContent = circledNumber(index);
  badge.style.top = `${rect.top - 12}px`;
  badge.style.left = `${rect.left + rect.width - 12}px`;
  document.body.appendChild(badge);
}

// ── Done page with work order ──
function renderDone(container: HTMLElement): void {
  annotationMode = false;
  document.body.classList.remove('fixit-annotation-mode');

  container.innerHTML = `
    <div class="w-full max-w-2xl">
      <div class="text-center mb-8">
        <div class="text-6xl mb-4">🎉</div>
        <h1 class="text-3xl font-bold text-slate-800 mb-2 tracking-tight" data-i18n="playground.complete.title">恭喜！</h1>
        <p class="text-base text-slate-500" data-i18n="playground.complete.desc">你已掌握 FixIt 的基本用法</p>
      </div>
      
      <div class="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">
        <div class="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div class="text-sm font-semibold text-slate-700" data-i18n="playground.workOrder">工单预览</div>
          <button id="copy-work-order" class="px-4 py-1.5 bg-blue-500 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors">
            <span data-i18n="sidepanel.copy">复制</span>
          </button>
        </div>
        <div id="work-order-content" class="p-6 text-sm text-slate-700 font-mono whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto"></div>
      </div>
      
      <div class="mt-8 text-center">
        <button id="restart-btn" class="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-medium hover:bg-slate-200 transition-colors">
          <span data-i18n="playground.restart">重新开始</span>
        </button>
      </div>
    </div>
    <div class="fireworks" id="fireworks-container"></div>
  `;

  renderWorkOrderPreview();

  document.getElementById('copy-work-order')?.addEventListener('click', async () => {
    const md = await exportToMarkdown(
      annotations,
      document.title,
      window.location.href,
    );
    try {
      await navigator.clipboard.writeText(md);
      const btn = document.getElementById('copy-work-order');
      if (btn) {
        btn.textContent = t('sidepanel.copied') || '已复制！';
        setTimeout(() => { btn.textContent = t('sidepanel.copy') || '复制'; }, 2000);
      }
    } catch { /* clipboard blocked */ }
  });

  document.getElementById('restart-btn')?.addEventListener('click', () => {
    annotations.length = 0;
    sequenceIndex = 0;
    document.querySelectorAll('.fixit-badge').forEach((b) => b.remove());
    renderStep('welcome');
  });

  applyI18n();
  showFireworks();
}

function renderWorkOrderPreview(): void {
  const content = document.getElementById('work-order-content');
  if (!content) return;

  if (annotations.length === 0) {
    content.textContent = t('playground.noAnnotations') || '暂无标注';
    return;
  }

  const lines: string[] = [];
  for (const ann of annotations.sort((a, b) => a.sequenceIndex - b.sequenceIndex)) {
    lines.push(`${circledNumber(ann.sequenceIndex)} ${ann.userComment}`);
    lines.push(`   CSS: ${ann.cssSelector}`);
    lines.push(`   XPath: ${ann.xpath}`);
    lines.push('');
  }
  content.textContent = lines.join('\n');
}

// ── Fireworks ──
function showFireworks(): void {
  const container = document.getElementById('fireworks-container');
  if (!container) return;
  const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
  const positions = [
    { x: '20%', y: '25%', d: 0.2 }, { x: '70%', y: '15%', d: 0.6 },
    { x: '45%', y: '40%', d: 1.0 }, { x: '80%', y: '45%', d: 1.4 },
    { x: '15%', y: '50%', d: 1.8 },
  ];
  for (const pos of positions) {
    const group = document.createElement('div');
    group.className = 'burst-group';
    group.style.left = pos.x;
    group.style.top = pos.y;
    group.style.animationDelay = `${pos.d}s`;
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = (i / 14) * 2 * Math.PI;
      const dist = 70 + Math.random() * 70;
      p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
      p.style.background = colors[i % colors.length];
      group.appendChild(p);
    }
    container.appendChild(group);
  }
}

// ── Init ──
async function init(): Promise<void> {
  const locale = await detectLocaleAsync();
  setLocale(locale);
  renderStep('welcome');
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}

export { renderStep, sequenceIndex, currentStep, showFireworks, showInlineBubble, annotations };
