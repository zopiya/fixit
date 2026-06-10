# FixIt

> 面向前端工程师的 Chrome 扩展：点选式 UI 标注，一键生成结构化 AI 修改工单。

FixIt 让前端开发者在浏览器中直接点选问题元素，一键生成结构化 AI 修改工单，粘贴到 Claude Code / Cursor / Windsurf 即可执行。

**零配置 · 零网络 · 零登录** — 安装即用，所有数据留在本地。

---

## 功能特性

- **点选标注** — 激活标注模式后，悬停高亮、点击元素、写批注，三步完成标注
- **双轨定位** — 智能 CSS Selector 优先级链 + 截断式 XPath 双轨定位，覆盖 styled-components / MUI / Vue scoped 等框架
- **Shadow DOM 隔离** — 所有注入 UI 通过 closed-mode Shadow DOM 渲染，宿主页面零污染
- **侧边栏面板** — 右侧边栏实时展示标注列表，支持单条删除、一键清空
- **AI 工单导出** — 结构化 Markdown 工单，包含 CSS Selector、XPath、置信度、HTML 快照
- **交互式教程** — 内置 3 步交互式教程，1 分钟上手
- **国际化** — 中英双语，跟随系统或手动切换
- **本地持久化** — `chrome.storage.local` 本地持久化，刷新不丢失

---

## 快速开始

### 前置条件

- [Bun](https://bun.sh) ≥ 1.1（或 npm）
- Chrome ≥ 114

### 安装与开发

```bash
git clone https://github.com/zopiya/fixit.git
cd fixit
bun install
bun run dev
```

### 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启 **开发者模式**（右上角）
3. 点击 **加载已解压的扩展程序** → 选择 `dist/chrome-mv3/`
4. 将 FixIt 图标固定到工具栏

按下 `Alt+Shift+F` 切换标注模式。

---

## 使用方法

```
[Alt+Shift+F] → [悬停并点击元素] → [写批注] → [重复] → [复制工单] → [粘贴给 AI]
```

1. **激活** — 按下 `Alt+Shift+F` 或点击工具栏图标
2. **标注** — 悬停任意元素（出现蓝色高亮），点击打开标注气泡
3. **批注** — 输入修改请求，按回车确认。元素上会出现编号徽章
4. **导出** — 打开侧边栏，查看所有标注，点击 **复制工单**
5. **执行** — 粘贴到 Claude Code / Cursor / Windsurf — AI 代理读取结构化工单并执行修改

### 交互式教程（新手引导）

首次安装后，教程页面自动打开，包含 3 个引导任务：

1. 点击错位的提交按钮 → 标注位置问题
2. 找到颜色错误的文字 → 标注颜色问题
3. 标注旋转的卡片布局问题

完成全部 3 个任务后，会看到烟花动画和生成工单的预览。

---

## 架构

```
┌─────────────────────────────────────────────────────┐
│  Content Script（感知层）                             │
│  ├── 悬停高亮器                                       │
│  ├── Shadow DOM 覆盖层（气泡 + 徽章）                  │
│  └── 双轨定位器（CSS Selector + XPath）               │
└──────────────────────┬──────────────────────────────┘
                       │ Chrome IPC
                       ▼
┌─────────────────────────────────────────────────────┐
│  Background Service Worker（路由中枢）                 │
│  ├── 标注 CRUD                                       │
│  ├── 标签页生命周期监听                                │
│  └── 消息路由（Content ↔ 侧边栏）                     │
└──────────────────────┬──────────────────────────────┘
                       ▼
┌─────────────────────────────────────────────────────┐
│  Side Panel UI（展示层）                              │
│  ├── 标注列表渲染器                                   │
│  ├── 标签页同步控制器                                  │
│  └── Markdown 工单生成器 + 剪贴板                      │
└─────────────────────────────────────────────────────┘
```

四个隔离的 Chrome 上下文通过 `chrome.runtime` 消息通信：

| 上下文 | 文件 | 职责 |
|--------|------|------|
| Content Script | `entrypoints/content.ts` | 注入网页 — 感知与标注 |
| Background | `entrypoints/background.ts` | Service Worker — 消息路由与存储 |
| Side Panel | `entrypoints/sidepanel/` | 标注面板与工单导出 |
| Playground | `entrypoints/playground/` | 新手引导教程，包含故意设置的 UI 问题 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 构建 | [WXT](https://wxt.dev)（基于 Vite 的 MV3 框架） |
| 运行时 | [Bun](https://bun.sh)（备选：npm） |
| 语言 | TypeScript（严格模式） |
| 样式 | [Tailwind CSS v4](https://tailwindcss.com) |
| 测试 | [Vitest](https://vitest.dev) + happy-dom |
| 代码检查 | ESLint + Prettier |
| 浏览器 | Chrome ≥ 114（Side Panel API） |

---

## 项目结构

```
fixit/
├── entrypoints/                  # Chrome 扩展入口（WXT 约定）
│   ├── content.ts                # Content Script — 标注模式、快捷键、消息通信
│   ├── background.ts             # Service Worker — 消息路由、存储、标签页同步
│   ├── sidepanel/                # 侧边栏 — 标注列表、导出
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── renderer.ts
│   │   └── exporter.ts
│   ├── playground/               # 新手引导 — 3 步交互式教程
│   │   ├── index.html
│   │   └── main.ts
│   └── settings/                 # 扩展设置页面
│       ├── index.html
│       └── main.ts
│
├── src/
│   ├── content/
│   │   ├── highlighter.ts        # 悬停高亮逻辑
│   │   ├── overlay.ts            # Shadow DOM 气泡与徽章
│   │   └── locator/
│   │       ├── css-selector.ts   # 6 级优先级链 CSS Selector 生成器
│   │       ├── xpath.ts          # 截断式 XPath，支持锚点检测
│   │       └── index.ts
│   ├── shared/
│   │   ├── types.ts              # FixItAnnotation、MessageType、Message
│   │   ├── storage.ts            # chrome.storage.local CRUD 封装
│   │   ├── settings.ts           # 用户设置管理
│   │   ├── i18n.ts               # 中英双语翻译系统
│   │   ├── utils.ts              # URL 规范化、辅助工具函数
│   │   └── icon-state.ts         # 工具栏图标状态管理
│   └── styles/
│       └── global.css            # Tailwind CSS 入口
│
├── tests/                        # 16 个测试文件，230+ 测试用例
│   ├── content/
│   ├── entrypoints/
│   ├── shared/
│   └── integration/
│
├── docs/                         # 产品与技术文档
│   ├── FixIt_PRD.md
│   ├── FixIt_TechDoc.md
│   └── FixIt_DevPlan.md
│
├── wxt.config.ts                 # WXT 配置（manifest 自动生成）
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 开发

### 命令

```bash
bun run dev          # 监听模式，支持 HMR
bun run build        # 生产构建，输出到 dist/chrome-mv3/
bun run typecheck    # TypeScript 类型检查
bun run lint         # ESLint 检查
bun run format       # Prettier 格式化
bun run test         # Vitest 测试套件
```

### WXT 注意事项

`manifest.json` 由 `wxt.config.ts` 自动生成 — 请勿手动编写。

### CSS Selector 算法

核心创新 — 6 级优先级链，生成唯一选择器：

| 优先级 | 来源 | 示例 |
|--------|------|------|
| 1 | `data-testid` / `data-cy` / `data-qa` | `[data-testid="submit-btn"]` |
| 2 | 语义化 `id`（排除哈希值风格） | `#login-form` |
| 3 | `aria-label` / `role` | `button[aria-label="Close"]` |
| 4 | 表单元素 `name` | `input[name="email"]` |
| 5 | 语义化 class 组合 | `button.btn-primary` |
| 6 | 结构路径（最多 3 层） | `#form > .actions > button:last-child` |

每级通过 `document.querySelectorAll()` 验证唯一性。置信度记录在工单中供 AI 参考。

---

## 测试

```bash
bun run test                    # 全部测试
bun run test src/content/locator/css-selector.spec.ts  # 单个文件
```

**测试覆盖亮点：**
- styled-components、MUI、Vue scoped 属性
- 纯结构 DOM（无 class/id）
- 边界场景：动态内容、iframe、表单元素
- 完整 E2E 集成测试（content → background → sidepanel 数据流）

---

## 构建与发布

### 生产构建

```bash
bun run build
# 输出目录：dist/chrome-mv3/
```

### 在 Chrome 中加载（开发）

1. `chrome://extensions/` → 开发者模式 → 加载已解压的扩展程序
2. 选择 `dist/chrome-mv3/`

### 发布到 Chrome 应用商店

1. 构建：`cd dist/chrome-mv3 && zip -r ../fixit.zip .`
2. 前往 [Chrome 应用商店开发者控制台](https://chrome.google.com/webstore/devconsole)
3. 支付 $5 注册费（一次性）
4. 上传 `fixit.zip`，填写商店信息（分类：开发者工具）
5. 提交审核（通常 1-3 个工作日）

---

## 路线图

### V1 — 核心循环（当前）

点选标注 → 结构化 AI 工单 → 粘贴给 AI 代理。

- 双轨定位算法
- Shadow DOM 隔离
- 侧边栏面板
- Markdown 工单导出
- 交互式新手教程

### V2 — AI 增强（规划中）

AI 驱动的批注优化 — 自动将原始批注润色为精确的修改指令。

### V3 — 可视化调参（未来）

轻量级可视化调节滑块（间距、圆角、颜色预设），配合 CSS diff 注入。

---

## 许可证

MIT
