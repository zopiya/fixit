# FixIt — Chrome Extension for AI-Assisted Frontend Debugging

## Project Status

**Fully implemented** — Chrome extension with content script, background service worker, side panel, playground, settings page, and comprehensive test suite (230+ test cases). V1 core loop complete.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Build | WXT (Vite-based MV3 framework) |
| Runtime | Bun (fallback: npm) |
| Language | TypeScript (strict mode) |
| UI | Native HTML5/CSS3 — no frameworks |
| Testing | Vitest + happy-dom |
| Lint | ESLint + Prettier |
| Browser | Chrome ≥ 114 (Side Panel API) |

## Commands

```bash
bun run dev          # Watch mode with HMR
bun run build        # Production build to dist/
bun run typecheck    # tsc --noEmit
bun run lint         # ESLint check
bun run format       # Prettier formatting
bun run test         # Vitest suite
```

**WXT note:** `manifest.json` is auto-generated from `wxt.config.ts` — never hand-write it.

## Architecture

Chrome extension with 4 isolated contexts:

- **Content Script** (`src/content/`) — perception layer: hover highlights, annotation bubbles in Shadow DOM (closed mode), element localization (CSS Selector + XPath)
- **Background Service Worker** (`src/background/`) — message routing, extension lifecycle
- **Side Panel** (`src/sidepanel/`) — annotation dashboard, Markdown work order export
- **Playground** (`src/playground/`) — onboarding page with intentional UI bugs

## Key Design Decisions

- `action.onClicked` toggles annotation mode AND opens Side Panel simultaneously
- Shadow DOM uses **closed** mode; events use `stopPropagation` inside shadow
- CSS Selector priority chain is the core algorithm (Sprint 1 highest priority)
- `FixItAnnotation` includes V2 reserved fields (`aiRefinedComment?`, `visualDiff?`) — define now, leave `undefined` in V1
- Lost badges (relocation failure) marked as "disconnected", not silently dropped

## Testing

```bash
bun run test                    # All tests
bun run test src/content/locator/css-selector.spec.ts  # Single file
```

**Critical test coverage for Sprint 1:**
- styled-components, MUI, Vue scoped attributes
- Structural-only DOM (no classes/IDs)
- Edge cases: dynamic content, iframes

## Project Structure

```
fixit/
├── entrypoints/                  # Chrome extension entry points (WXT convention)
│   ├── content.ts                # Content script — annotation mode, hotkey, messaging
│   ├── background.ts             # Service worker — message routing, storage, tab sync
│   ├── sidepanel/                # Side panel — annotation list, export
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── renderer.ts
│   │   └── exporter.ts
│   ├── playground/               # Onboarding — 3-step interactive tutorial
│   │   ├── index.html
│   │   └── main.ts
│   └── settings/                 # Extension settings page
│       ├── index.html
│       └── main.ts
├── src/
│   ├── content/
│   │   ├── highlighter.ts        # Hover highlight logic
│   │   ├── overlay.ts            # Shadow DOM bubbles & badges
│   │   └── locator/
│   │       ├── css-selector.ts   # 6-level priority chain CSS Selector generator
│   │       ├── xpath.ts          # Truncated XPath with anchor detection
│   │       └── index.ts
│   ├── shared/
│   │   ├── types.ts              # FixItAnnotation, MessageType, Message
│   │   ├── storage.ts            # chrome.storage.local CRUD wrapper
│   │   ├── settings.ts           # User settings management
│   │   ├── i18n.ts               # Chinese/English translation system
│   │   ├── utils.ts              # URL normalization, misc helpers
│   │   └── icon-state.ts         # Toolbar icon state management
│   └── styles/
│       └── global.css            # Tailwind CSS entry point
├── tests/                        # 16 test files, 230+ test cases
├── docs/                         # Product & technical documentation
├── wxt.config.ts                 # WXT configuration (manifest auto-generated)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## References

- `docs/FixIt_PRD.md` — Product requirements
- `docs/FixIt_TechDoc.md` — Technical architecture (579 lines)
- `docs/FixIt_DevPlan.md` — Sprint plan with task breakdown
