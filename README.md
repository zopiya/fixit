# FixIt

> Chrome extension for frontend engineers: point-and-click UI annotations that generate structured AI work orders.

FixIt 让前端开发者在浏览器中直接点选问题元素，一键生成结构化 AI 修改工单，粘贴到 Claude Code / Cursor / Windsurf 即可执行。

**零配置 · 零网络 · 零登录** — 安装即用，所有数据留在本地。

---

## Features

- **Point & Click** — 激活标注模式后，悬停高亮、点击元素、写批注，三步完成标注
- **Dual-track Locators** — 智能 CSS Selector 优先级链 + 截断式 XPath 双轨定位，覆盖 styled-components / MUI / Vue scoped 等框架
- **Shadow DOM Isolation** — 所有注入 UI 通过 closed-mode Shadow DOM 渲染，宿主页面零污染
- **Side Panel Dashboard** — 右侧边栏实时展示标注列表，支持单条删除、一键清空
- **AI Work Order Export** — 结构化 Markdown 工单，包含 CSS Selector、XPath、置信度、HTML 快照
- **Playground Onboarding** — 内置 3 步交互式教程，1 分钟上手
- **i18n** — 中英双语，跟随系统或手动切换
- **Persistent** — `chrome.storage.local` 本地持久化，刷新不丢失

---

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1 (or npm)
- Chrome ≥ 114

### Install & Dev

```bash
git clone https://github.com/your-username/fixit.git
cd fixit
bun install
bun run dev
```

### Load into Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** → select `.output/chrome-mv3/`
4. Pin the FixIt icon to your toolbar

Press `Alt+Shift+F` to toggle annotation mode.

---

## Usage

```
[Alt+Shift+F] → [Hover & Click element] → [Write comment] → [Repeat] → [Copy work order] → [Paste to AI]
```

1. **Activate** — Press `Alt+Shift+F` or click the toolbar icon
2. **Annotate** — Hover over any element (blue highlight appears), click to open the annotation bubble
3. **Comment** — Type your modification request, press Enter to confirm. A numbered badge appears on the element
4. **Export** — Open the Side Panel, review all annotations, click **Copy Work Order**
5. **Execute** — Paste into Claude Code / Cursor / Windsurf — AI agent reads the structured work order and applies changes

### Playground (Onboarding)

After first install, the Playground opens automatically with 3 guided tasks:

1. Click the misaligned submit button → annotate the position issue
2. Find the text with wrong color → annotate the color issue
3. Annotate the rotated card layout problem

Complete all 3 to see the fireworks animation and a preview of the generated work order.

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Content Script (Perception Layer)                   │
│  ├── Hover Highlighter                               │
│  ├── Shadow DOM Overlay (bubbles + badges)           │
│  └── Dual-track Locator (CSS Selector + XPath)      │
└──────────────────────┬──────────────────────────────┘
                       │ Chrome IPC
                       ▼
┌─────────────────────────────────────────────────────┐
│  Background Service Worker (Routing Hub)             │
│  ├── Annotation CRUD                                 │
│  ├── Tab Lifecycle Listener                          │
│  └── Message Router (Content ↔ Side Panel)           │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Side Panel UI (Presentation Layer)                  │
│  ├── Annotation List Renderer                        │
│  ├── Tab Sync Controller                             │
│  └── Markdown Work Order Generator + Clipboard       │
└─────────────────────────────────────────────────────┘
```

Four isolated Chrome contexts communicate via `chrome.runtime` messaging:

| Context | File | Role |
|---------|------|------|
| Content Script | `entrypoints/content.ts` | Injected into web pages — perception & annotation |
| Background | `entrypoints/background.ts` | Service worker — message routing & storage |
| Side Panel | `entrypoints/sidepanel/` | Annotation dashboard & work order export |
| Playground | `entrypoints/playground/` | Onboarding tutorial with intentional UI bugs |

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Build | [WXT](https://wxt.dev) (Vite-based MV3 framework) |
| Runtime | [Bun](https://bun.sh) (fallback: npm) |
| Language | TypeScript (strict mode) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com) |
| Testing | [Vitest](https://vitest.dev) + happy-dom |
| Lint | ESLint + Prettier |
| Browser | Chrome ≥ 114 (Side Panel API) |

---

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
│
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
│
├── tests/                        # 16 test files, 230+ test cases
│   ├── content/
│   ├── entrypoints/
│   ├── shared/
│   └── integration/
│
├── docs/                         # Product & technical documentation
│   ├── FixIt_PRD.md
│   ├── FixIt_TechDoc.md
│   └── FixIt_DevPlan.md
│
├── wxt.config.ts                 # WXT configuration (manifest auto-generated)
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## Development

### Commands

```bash
bun run dev          # Watch mode with HMR
bun run build        # Production build to .output/chrome-mv3/
bun run typecheck    # TypeScript type checking
bun run lint         # ESLint check
bun run format       # Prettier formatting
bun run test         # Vitest suite
```

### WXT Note

`manifest.json` is auto-generated from `wxt.config.ts` — never hand-write it.

### CSS Selector Algorithm

The core innovation — a 6-level priority chain that generates unique selectors:

| Priority | Source | Example |
|----------|--------|---------|
| 1 | `data-testid` / `data-cy` / `data-qa` | `[data-testid="submit-btn"]` |
| 2 | Semantic `id` (excludes hash-like) | `#login-form` |
| 3 | `aria-label` / `role` | `button[aria-label="Close"]` |
| 4 | Form element `name` | `input[name="email"]` |
| 5 | Semantic class combo | `button.btn-primary` |
| 6 | Structural path (up to 3 levels) | `#form > .actions > button:last-child` |

Each level is validated with `document.querySelectorAll()` for uniqueness. Confidence level is recorded in the work order for AI reference.

---

## Testing

```bash
bun run test                    # All tests
bun run test src/content/locator/css-selector.spec.ts  # Single file
```

**Test coverage highlights:**
- styled-components, MUI, Vue scoped attributes
- Structural-only DOM (no classes/IDs)
- Edge cases: dynamic content, iframes, form elements
- Full E2E integration test (content → background → sidepanel data flow)

---

## Building & Publishing

### Build for Production

```bash
bun run build
# Output: .output/chrome-mv3/
```

### Load in Chrome (Development)

1. `chrome://extensions/` → Developer mode → Load unpacked
2. Select `.output/chrome-mv3/`

### Publish to Chrome Web Store

1. Build: `cd .output/chrome-mv3 && zip -r ../fixit.zip .`
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. Pay $5 registration fee (one-time)
4. Upload `fixit.zip`, fill in store listing (category: Developer Tools)
5. Submit for review (typically 1-3 business days)

---

## Roadmap

### V1 — Core Loop (Current)

Point-and-click annotation → structured AI work order → paste to AI agent.

- Dual-track locator algorithm
- Shadow DOM isolation
- Side Panel dashboard
- Markdown work order export
- Playground onboarding

### V2 — AI Enhancement (Planned)

AI-powered comment refinement — auto-polish raw comments into precise modification instructions.

### V3 — Visual Tuning (Future)

Lightweight visual adjustment sliders (spacing, border-radius, color presets) with CSS diff injection.

---

## License

MIT
