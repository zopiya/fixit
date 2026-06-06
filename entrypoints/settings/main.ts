import { t, setLocale, detectLocaleAsync } from '../../src/shared/i18n';
import { getSettings, saveSettings, resetSettings } from '../../src/shared/settings';

/** Apply i18n translations to all elements with data-i18n attribute. */
function applyI18n(): void {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      const translation = t(key);
      if (translation !== key) el.textContent = translation;
    }
  });
}

async function init(): Promise<void> {
  const locale = await detectLocaleAsync();
  setLocale(locale);
  applyI18n();

  const settings = await getSettings();

  // Language
  const langSelect = document.getElementById('language-select') as HTMLSelectElement | null;
  if (langSelect) {
    langSelect.value = settings.locale;
    langSelect.addEventListener('change', async () => {
      await saveSettings({ locale: langSelect.value as 'auto' | 'zh' | 'en' });
      const newLocale = await detectLocaleAsync();
      setLocale(newLocale);
      applyI18n();
    });
  }

  // Highlight color
  const colorInput = document.getElementById('highlight-color') as HTMLInputElement | null;
  if (colorInput) {
    colorInput.value = settings.highlightColor;
    colorInput.addEventListener('change', () => saveSettings({ highlightColor: colorInput.value }));
  }

  // Border width
  const borderWidth = document.getElementById('border-width') as HTMLSelectElement | null;
  if (borderWidth) {
    borderWidth.value = String(settings.highlightBorderWidth);
    borderWidth.addEventListener('change', () =>
      saveSettings({ highlightBorderWidth: Number(borderWidth.value) }),
    );
  }

  // Snapshot length
  const snapshotLength = document.getElementById('snapshot-length') as HTMLSelectElement | null;
  if (snapshotLength) {
    snapshotLength.value = String(settings.snapshotMaxLength);
    snapshotLength.addEventListener('change', () =>
      saveSettings({ snapshotMaxLength: Number(snapshotLength.value) }),
    );
  }

  // Flash duration
  const flashDuration = document.getElementById('flash-duration') as HTMLSelectElement | null;
  if (flashDuration) {
    flashDuration.value = String(settings.highlightFlashMs);
    flashDuration.addEventListener('change', () =>
      saveSettings({ highlightFlashMs: Number(flashDuration.value) }),
    );
  }

  // Auto-open playground
  const autoPlayground = document.getElementById('auto-playground') as HTMLInputElement | null;
  if (autoPlayground) {
    autoPlayground.checked = settings.autoOpenPlayground;
    autoPlayground.addEventListener('change', () =>
      saveSettings({ autoOpenPlayground: autoPlayground.checked }),
    );
  }

  // Custom hotkey
  const hotkeyInput = document.getElementById('custom-hotkey') as HTMLInputElement | null;
  if (hotkeyInput) {
    hotkeyInput.value = settings.customHotkey;
    hotkeyInput.addEventListener('keydown', (e) => {
      e.preventDefault();
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        parts.push(e.key.toUpperCase());
      }
      hotkeyInput.value = parts.join('+');
    });
    hotkeyInput.addEventListener('change', () => {
      saveSettings({ customHotkey: hotkeyInput.value });
    });
  }

  // Copy context checkboxes
  const ctxKeys = ['comment', 'css', 'xpath', 'confidence', 'snapshot'] as const;
  const settingsMap = { comment: 'comment', css: 'cssSelector', xpath: 'xpath', confidence: 'confidence', snapshot: 'htmlSnapshot' } as const;

  for (const key of ctxKeys) {
    const checkbox = document.getElementById(`ctx-${key}`) as HTMLInputElement | null;
    if (checkbox) {
      const settingsKey = settingsMap[key];
      checkbox.checked = settings.copyContext[settingsKey];
      checkbox.addEventListener('change', () => {
        saveSettings({ copyContext: { ...settings.copyContext, [settingsKey]: checkbox.checked } });
      });
    }
  }

  // Reset button
  const resetBtn = document.getElementById('reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      await resetSettings();
      location.reload();
    });
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}
