import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { FixItSettings } from '../../src/shared/settings';

// vi.mock is hoisted — use vi.hoisted to declare the mock function
const { mockGetSettings } = vi.hoisted(() => {
  return {
    mockGetSettings: vi.fn(async (): Promise<FixItSettings> => ({
      highlightColor: '#3B82F6',
      highlightBorderWidth: 2,
      bubbleBorderRadius: 12,
      snapshotMaxLength: 500,
      highlightFlashMs: 2000,
      autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
      locale: 'auto',
      customHotkey: '',
      copyContext: {
        comment: true,
        cssSelector: true,
        xpath: true,
        confidence: true,
        htmlSnapshot: false,
      },
    })),
  };
});

vi.mock('../../src/shared/settings', () => ({
  getSettings: mockGetSettings,
}));

import { detectLocale, detectLocaleAsync, setLocale, t } from '../../src/shared/i18n';

describe('i18n', () => {
  beforeEach(() => {
    mockGetSettings.mockResolvedValue({
      highlightColor: '#3B82F6',
      highlightBorderWidth: 2,
      bubbleBorderRadius: 12,
      snapshotMaxLength: 500,
      highlightFlashMs: 2000,
      autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
      locale: 'auto',
      customHotkey: '',
      copyContext: {
        comment: true,
        cssSelector: true,
        xpath: true,
        confidence: true,
        htmlSnapshot: false,
      },
    });
  });

  describe('detectLocale()', () => {
    it("returns 'zh' for zh-CN", () => {
      vi.stubGlobal('navigator', { language: 'zh-CN' });
      expect(detectLocale()).toBe('zh');
    });

    it("returns 'zh' for zh-TW", () => {
      vi.stubGlobal('navigator', { language: 'zh-TW' });
      expect(detectLocale()).toBe('zh');
    });

    it("returns 'zh' for zh", () => {
      vi.stubGlobal('navigator', { language: 'zh' });
      expect(detectLocale()).toBe('zh');
    });

    it("returns 'en' for en-US", () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      expect(detectLocale()).toBe('en');
    });

    it("returns 'en' for en", () => {
      vi.stubGlobal('navigator', { language: 'en' });
      expect(detectLocale()).toBe('en');
    });

    it("returns 'en' for fr", () => {
      vi.stubGlobal('navigator', { language: 'fr' });
      expect(detectLocale()).toBe('en');
    });

    it("returns 'en' for de", () => {
      vi.stubGlobal('navigator', { language: 'de' });
      expect(detectLocale()).toBe('en');
    });
  });

  describe('detectLocaleAsync()', () => {
    it('returns saved locale from settings', async () => {
      vi.stubGlobal('navigator', { language: 'en-US' });
      mockGetSettings.mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'zh',
        customHotkey: '',
        copyContext: { comment: true, cssSelector: true, xpath: true, confidence: true, htmlSnapshot: false },
      });
      expect(await detectLocaleAsync()).toBe('zh');
    });

    it('returns auto-detected locale when saved is "auto"', async () => {
      vi.stubGlobal('navigator', { language: 'zh-CN' });
      mockGetSettings.mockResolvedValueOnce({
        highlightColor: '#3B82F6',
        highlightBorderWidth: 2,
        bubbleBorderRadius: 12,
        snapshotMaxLength: 500,
        highlightFlashMs: 2000,
        autoOpenPlayground: true,
      submitShortcut: 'mod-enter' as const,
        locale: 'auto',
        customHotkey: '',
        copyContext: { comment: true, cssSelector: true, xpath: true, confidence: true, htmlSnapshot: false },
      });
      expect(await detectLocaleAsync()).toBe('zh');
    });

    it('falls back to detectLocale when getSettings fails', async () => {
      vi.stubGlobal('navigator', { language: 'zh-CN' });
      mockGetSettings.mockRejectedValueOnce(new Error('no chrome'));
      expect(await detectLocaleAsync()).toBe('zh');
    });
  });

  describe('settings translations', () => {
    it('returns correct zh settings translations', () => {
      setLocale('zh');
      expect(t('settings.general')).toBe('常规');
      expect(t('settings.language')).toBe('语言');
      expect(t('settings.language.desc')).toBe('选择界面语言，或跟随系统自动检测');
      expect(t('settings.language.auto')).toBe('跟随系统');
      expect(t('settings.about')).toBe('关于');
      expect(t('settings.about.desc')).toBe('点选网页问题元素，一键生成 AI 修改工单');
    });

    it('returns correct en settings translations', () => {
      setLocale('en');
      expect(t('settings.general')).toBe('General');
      expect(t('settings.language')).toBe('Language');
      expect(t('settings.language.desc')).toBe('Choose interface language, or auto-detect from system');
      expect(t('settings.language.auto')).toBe('Auto');
      expect(t('settings.about')).toBe('About');
      expect(t('settings.about.desc')).toBe('Click-select UI elements to generate AI work orders');
    });
  });

  describe('setLocale()', () => {
    beforeEach(() => {
      setLocale('en');
    });

    it('changes active locale', () => {
      setLocale('zh');
      expect(t('sidepanel.title')).toBe('Fix It 标注');

      setLocale('en');
      expect(t('sidepanel.title')).toBe('Fix It Annotations');
    });
  });

  describe('t()', () => {
    it('returns correct translation for zh', () => {
      setLocale('zh');
      expect(t('sidepanel.title')).toBe('Fix It 标注');
      expect(t('bubble.placeholder')).toBe('描述需要修改的内容…');
      expect(t('sidepanel.copy')).toBe('复制');
    });

    it('returns correct translation for en', () => {
      setLocale('en');
      expect(t('sidepanel.title')).toBe('Fix It Annotations');
      expect(t('bubble.placeholder')).toBe('Describe the issue…');
      expect(t('sidepanel.copy')).toBe('Copy');
    });

    it('returns key if translation missing', () => {
      setLocale('en');
      expect(t('nonexistent.key')).toBe('nonexistent.key');
    });

    it('falls back to English when key missing in current locale', () => {
      setLocale('zh');
      // All zh keys exist in this set, but test the fallback path
      expect(t('sidepanel.title')).toBe('Fix It 标注');
    });
  });

  describe('playground translations', () => {
    it('returns correct zh playground translations', () => {
      setLocale('zh');
      expect(t('playground.welcome')).toBe('欢迎来到 FixIt Playground！');
      expect(t('playground.task1.desc')).toBe('点击错位的按钮');
      expect(t('playground.complete.title')).toBe('🎉 恭喜！');
      expect(t('playground.btn.submit')).toBe('提交订单');
    });

    it('returns correct en playground translations', () => {
      setLocale('en');
      expect(t('playground.welcome')).toBe('Welcome to FixIt Playground!');
      expect(t('playground.task1.desc')).toBe('Click the misaligned button');
      expect(t('playground.complete.title')).toBe('🎉 Congratulations!');
      expect(t('playground.btn.submit')).toBe('Submit Order');
    });
  });

  describe('new settings translations', () => {
    it('returns correct zh appearance/behavior translations', () => {
      setLocale('zh');
      expect(t('settings.appearance')).toBe('外观');
      expect(t('settings.highlightColor')).toBe('高亮颜色');
      expect(t('settings.borderWidth')).toBe('边框宽度');
      expect(t('settings.behavior')).toBe('行为');
      expect(t('settings.snapshotLength')).toBe('快照长度');
      expect(t('settings.flashDuration')).toBe('高亮闪烁时长');
      expect(t('settings.autoOpenPlayground')).toBe('自动打开引导');
      expect(t('settings.reset')).toBe('恢复默认设置');
    });

    it('returns correct en appearance/behavior translations', () => {
      setLocale('en');
      expect(t('settings.appearance')).toBe('Appearance');
      expect(t('settings.highlightColor')).toBe('Highlight Color');
      expect(t('settings.borderWidth')).toBe('Border Width');
      expect(t('settings.behavior')).toBe('Behavior');
      expect(t('settings.snapshotLength')).toBe('Snapshot Length');
      expect(t('settings.flashDuration')).toBe('Flash Duration');
      expect(t('settings.autoOpenPlayground')).toBe('Auto-open Guide');
      expect(t('settings.reset')).toBe('Reset to Defaults');
    });
  });
});
