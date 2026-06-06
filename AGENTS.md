# FixIt — Chrome Extension for AI-Assisted Frontend Debugging

## Project Status

**Greenfield** — no source code exists yet. Only documentation is finalized (PRD, TechDoc, DevPlan). Sprint 0 (engineering init) is the first task.

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

## Project Structure (Planned)

```
fixit/
├── wxt.config.ts           # WXT configuration
├── package.json
├── tsconfig.json
├── src/
│   ├── content/            # Content script entry
│   │   ├── index.ts
│   │   ├── highlighter.ts
│   │   ├── overlay.ts
│   │   └── locator/
│   │       ├── css-selector.ts
│   │       └── xpath.ts
│   ├── background/
│   │   └── index.ts        # Service worker
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.ts
│   │   ├── renderer.ts
│   │   └── exporter.ts
│   ├── playground/
│   │   ├── index.html
│   │   └── index.ts
│   └── shared/
│       ├── types.ts        # FixItAnnotation, MessageType
│       ├── storage.ts      # chrome.storage.local wrapper
│       └── messages.ts
├── assets/icons/           # 16/32/48/128px
└── dist/                   # Build output
```

## References

- `docs/FixIt_PRD.md` — Product requirements
- `docs/FixIt_TechDoc.md` — Technical architecture (579 lines)
- `docs/FixIt_DevPlan.md` — Sprint plan with task breakdown
