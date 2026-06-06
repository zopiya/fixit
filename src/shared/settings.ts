export interface FixItSettings {
  // Appearance
  highlightColor: string;
  highlightBorderWidth: number;
  bubbleBorderRadius: number;

  // Behavior
  snapshotMaxLength: number;
  highlightFlashMs: number;
  autoOpenPlayground: boolean;

  // Locale
  locale: 'auto' | 'zh' | 'en';

  // Hotkey
  customHotkey: string;

  // Copy context
  copyContext: {
    comment: boolean;
    cssSelector: boolean;
    xpath: boolean;
    confidence: boolean;
    htmlSnapshot: boolean;
  };
}

const SETTINGS_KEY = 'fixit:settings';

const DEFAULTS: FixItSettings = {
  highlightColor: '#3B82F6',
  highlightBorderWidth: 2,
  bubbleBorderRadius: 12,
  snapshotMaxLength: 500,
  highlightFlashMs: 2000,
  autoOpenPlayground: true,
  locale: 'auto',
  customHotkey: '',
  copyContext: {
    comment: true,
    cssSelector: true,
    xpath: true,
    confidence: true,
    htmlSnapshot: false,
  },
};

export function getDefaults(): FixItSettings {
  return { ...DEFAULTS };
}

export async function getSettings(): Promise<FixItSettings> {
  try {
    const data = await chrome.storage.local.get(SETTINGS_KEY);
    const saved = data[SETTINGS_KEY] as Partial<FixItSettings> | undefined;
    return { ...DEFAULTS, ...saved };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function saveSettings(settings: Partial<FixItSettings>): Promise<void> {
  const current = await getSettings();
  const merged = { ...current, ...settings };
  await chrome.storage.local.set({ [SETTINGS_KEY]: merged });
}

export async function resetSettings(): Promise<void> {
  await chrome.storage.local.set({ [SETTINGS_KEY]: { ...DEFAULTS } });
}
