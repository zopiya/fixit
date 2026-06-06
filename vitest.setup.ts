// Vitest setup: define WXT auto-import globals that content scripts expect
import { vi } from 'vitest';

vi.stubGlobal('defineContentScript', (opts: unknown) => opts);
vi.stubGlobal('defineBackground', (opts: unknown) => opts);
