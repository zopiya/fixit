# FixIt 技术文档

**版本：** V1.0  
**状态：** 定稿  
**最后更新：** 2026-06-06

---

## 一、技术栈

### 1.1 构建工具与语言

| 技术 | 版本要求 | 用途 |
|------|----------|------|
| **Bun** | ≥ 1.1 | 包管理器 + 构建打包（替代 npm + webpack，冷启动极快） |
| **TypeScript** | ≥ 5.4 | 全量强类型，保障跨模块消息传递的类型安全 |

### 1.2 浏览器规范

| 技术 | 说明 |
|------|------|
| **Chrome Extension Manifest V3** | 当前 Chrome 主流规范，长期兼容性有保障 |
| **Chrome Side Panel API** | `chrome.sidePanel`，实现右侧侧边栏面板 |
| **Chrome Storage API** | `chrome.storage.local`，本地持久化 |
| **Chrome Runtime Messaging API** | 跨模块异步消息总线 |

### 1.3 前端界面

原生 HTML5 / CSS3 / TypeScript，**不引入任何前端框架**（React/Vue 等）。

理由：Side Panel 和 Playground 页面结构简单，原生渲染性能最优，打包体积最小，侧边栏做到真正秒开。

### 1.4 不引入的依赖

- ❌ 任何云端服务或后端 API
- ❌ 任何 UI 组件库
- ❌ 任何状态管理库（Redux 等）
- ❌ 任何前端框架（V1 阶段）

---

## 二、整体架构设计

### 2.1 三模块架构

插件由三个核心模块组成，通过 Chrome Runtime Messaging API 进行异步数据通信：

```
[ 目标网页 (Target Tab) ]
       │
       ▼ (注入 Content Script)
┌──────────────────────────────────────────────────────┐
│  Content Script（感知层）                              │
│  ├── 悬停高亮监视器 (Hover Highlighter)               │
│  ├── Shadow DOM 隔离层 (批注气泡 + 数字徽章)           │
│  └── 双轨定位器 (CSS Selector + XPath Generator)     │
└──────────────────────┬───────────────────────────────┘
                       │
                       │ Chrome IPC 消息总线
                       ▼
┌──────────────────────────────────────────────────────┐
│  Background Service Worker（中枢层）                   │
│  ├── 标注数据的 CRUD 调度                              │
│  ├── 标签页生命周期监听                                │
│  └── 消息路由（Content Script ↔ Side Panel）          │
└──────────────────────┬───────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────┐
│  Side Panel UI（展示层）                               │
│  ├── 标注列表渲染器 (Annotation List Renderer)        │
│  ├── 标签页联动控制器                                  │
│  └── Markdown 工单生成器 + 剪贴板写入                  │
└──────────────────────────────────────────────────────┘
```

### 2.2 目录结构

```
fixit/
├── manifest.json
├── bun.lockb
├── package.json
├── tsconfig.json
│
├── src/
│   ├── content/
│   │   ├── index.ts          # Content Script 入口
│   │   ├── highlighter.ts    # 悬停高亮逻辑
│   │   ├── overlay.ts        # Shadow DOM 气泡与徽章
│   │   └── locator/
│   │       ├── css-selector.ts   # 主轨：CSS Selector 生成器
│   │       └── xpath.ts          # 副轨：XPath 生成器
│   │
│   ├── background/
│   │   └── index.ts          # Service Worker 入口
│   │
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── index.ts
│   │   ├── renderer.ts       # 标注列表渲染
│   │   └── exporter.ts       # Markdown 工单生成
│   │
│   ├── playground/
│   │   ├── index.html        # 新手引导游乐场
│   │   └── index.ts
│   │
│   └── shared/
│       ├── types.ts          # 公共类型定义（含 FixItAnnotation）
│       ├── storage.ts        # storage 读写封装
│       └── messages.ts       # 消息类型枚举
│
├── assets/
│   └── icons/                # 16/32/48/128px 插件图标
│
└── dist/                     # Bun 构建产物（上传 Chrome Store 用）
```

---

## 三、核心数据规格

### 3.1 标注数据结构

```typescript
export interface FixItAnnotation {
  id: string;                    // UUID v4，全局唯一
  url: string;                   // origin + pathname（存储 key，忽略 query/hash）
  fullUrl: string;               // 完整 URL，备用字段
  cssSelector: string;           // 主轨：语义 CSS Selector
  cssSelectorConfidence:         // 定位置信度，对应优先级链层级
    | 'data-attr'                //   最高，来自 data-testid 等
    | 'id'                       //   来自语义 id
    | 'aria'                     //   来自 aria-label/role
    | 'name'                     //   来自表单 name 属性
    | 'semantic-class'           //   来自语义 class 名
    | 'structural';              //   最低，来自结构路径
  xpath: string;                 // 副轨：优化截断版 XPath
  htmlSnapshot: string;          // 目标元素 outerHTML 片段（Max 500 chars，AI 校验锚点）
  userComment: string;           // 用户输入的修改批注
  sequenceIndex: number;         // 当前页面内的标注序号（①②③...）
  createdAt: number;             // Unix 时间戳（ms）
}
```

### 3.2 Storage 结构

```typescript
// key 规范：fixit:{origin+pathname}
// 例：fixit:http://localhost:3000/dashboard

// value：
{
  annotations: FixItAnnotation[]   // 该页面下所有标注，按 createdAt 排序
}
```

### 3.3 消息类型定义

```typescript
export enum MessageType {
  // Content Script → Background
  ADD_ANNOTATION    = 'ADD_ANNOTATION',
  UPDATE_ANNOTATION = 'UPDATE_ANNOTATION',
  DELETE_ANNOTATION = 'DELETE_ANNOTATION',

  // Background → Side Panel
  ANNOTATIONS_UPDATED = 'ANNOTATIONS_UPDATED',

  // Side Panel → Background
  GET_ANNOTATIONS   = 'GET_ANNOTATIONS',
  CLEAR_ALL         = 'CLEAR_ALL',
}

export interface Message<T = unknown> {
  type: MessageType;
  payload?: T;
  tabId?: number;
}
```

---

## 四、核心功能特性设计

### 4.1 双轨定位算法

#### 主轨：CSS Selector 生成器

**文件：** `src/content/locator/css-selector.ts`

**核心逻辑：** 按优先级链依次尝试，每一级生成候选后立刻调用 `document.querySelectorAll()` 验证唯一性，唯一则采纳并记录置信度。

```typescript
// Hash class 识别正则——这类自动生成的类名直接跳过
const GENERATED_CLASS_PATTERN =
  /^(sc-|css-|Mui[A-Z]|chakra-|_[a-zA-Z0-9]{5,}|[a-z]+-[a-z0-9]{6,}$)/;

function isSemanticClass(cls: string): boolean {
  return !GENERATED_CLASS_PATTERN.test(cls);
}

// 优先级链执行器
function generateCssSelector(el: Element): {
  selector: string;
  confidence: FixItAnnotation['cssSelectorConfidence'];
} {
  // 优先级 1：data-testid / data-cy / data-qa
  for (const attr of ['data-testid', 'data-cy', 'data-qa']) {
    const val = el.getAttribute(attr);
    if (val) {
      const s = `[${attr}="${val}"]`;
      if (isUnique(s)) return { selector: s, confidence: 'data-attr' };
    }
  }

  // 优先级 2：有语义的 id（排除哈希特征）
  if (el.id && isSemanticId(el.id)) {
    const s = `#${CSS.escape(el.id)}`;
    if (isUnique(s)) return { selector: s, confidence: 'id' };
  }

  // 优先级 3：aria-label + 标签名
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) {
    const s = `${el.tagName.toLowerCase()}[aria-label="${ariaLabel}"]`;
    if (isUnique(s)) return { selector: s, confidence: 'aria' };
  }

  // 优先级 4：表单 name 属性
  const name = el.getAttribute('name');
  if (name && isFormElement(el)) {
    const s = `${el.tagName.toLowerCase()}[name="${name}"]`;
    if (isUnique(s)) return { selector: s, confidence: 'name' };
  }

  // 优先级 5：语义 class 组合
  const semanticClasses = Array.from(el.classList).filter(isSemanticClass);
  if (semanticClasses.length > 0) {
    const s = `${el.tagName.toLowerCase()}.${semanticClasses.join('.')}`;
    if (isUnique(s)) return { selector: s, confidence: 'semantic-class' };
  }

  // 优先级 6：向上爬最多 3 层，从最近的稳定锚点开始拼结构路径
  return { selector: buildStructuralSelector(el), confidence: 'structural' };
}

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1;
  } catch {
    return false;
  }
}
```

#### 副轨：XPath 生成器

**文件：** `src/content/locator/xpath.ts`

**核心逻辑：** 向上遍历 DOM 树，从最近的有稳定属性（`id` 或 `data-*`）的祖先节点处截断，生成相对 XPath，避免从根部硬走绝对路径。

```typescript
function generateXPath(el: Element): string {
  // 找最近的稳定锚点祖先
  const anchor = findStableAncestor(el);

  if (!anchor || anchor === document.documentElement) {
    // 无稳定锚点时，生成优化的绝对路径（尽量用属性过滤）
    return buildAbsoluteXPath(el);
  }

  // 从锚点生成相对路径
  const anchorSelector = getAnchorXPathExpr(anchor);  // e.g. //form[@id='login-form']
  const relativePath = buildRelativeXPath(el, anchor); // e.g. //button[@type='submit']
  return `${anchorSelector}${relativePath}`;
}

function findStableAncestor(el: Element): Element | null {
  let current = el.parentElement;
  while (current && current !== document.documentElement) {
    if (current.id || Array.from(current.attributes).some(a => a.name.startsWith('data-'))) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}
```

### 4.2 Shadow DOM 隔离层

**文件：** `src/content/overlay.ts`

所有注入到目标页面的 UI 元素（高亮框、批注气泡、数字徽章）均通过 Shadow DOM 渲染，与宿主页面完全隔离。

```typescript
class FixItOverlay {
  private host: HTMLElement;
  private shadow: ShadowRoot;

  constructor() {
    this.host = document.createElement('fixit-overlay');
    // 使用 closed 模式防止外部脚本访问 shadow root
    this.shadow = this.host.attachShadow({ mode: 'closed' });
    // 注入私有样式，与宿主页面 100% 隔离
    this.shadow.innerHTML = `<style>${OVERLAY_STYLES}</style>`;
    document.documentElement.appendChild(this.host);
  }

  showHighlight(rect: DOMRect): void { /* 渲染高亮框 */ }
  showAnnotationBubble(el: Element): void { /* 渲染批注输入框 */ }
  renderBadge(el: Element, index: number): void { /* 渲染数字徽章 */ }
  destroy(): void { this.host.remove(); }
}
```

**高亮框实现要点：**
- 使用 `element.getBoundingClientRect()` 获取元素位置。
- 高亮框绝对定位在 overlay host 内，跟随目标元素位置渲染。
- 页面滚动时使用 `scroll` 事件更新位置。

### 4.3 侧边栏标签页联动

**文件：** `src/background/index.ts`

Side Panel 内容与当前激活标签页绑定，需主动监听标签页切换事件并通知侧边栏刷新：

```typescript
// 监听标签页切换
chrome.tabs.onActivated.addListener(({ tabId }) => {
  notifySidePanelRefresh(tabId);
});

// 监听标签页 URL 更新（SPA 路由切换等）
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    notifySidePanelRefresh(tabId);
  }
});

async function notifySidePanelRefresh(tabId: number) {
  const tab = await chrome.tabs.get(tabId);
  const url = tab.url ? normalizeUrl(tab.url) : null;
  if (!url) return;

  const data = await chrome.storage.local.get(`fixit:${url}`);
  const annotations: FixItAnnotation[] = data[`fixit:${url}`]?.annotations ?? [];

  // 通知侧边栏更新
  chrome.runtime.sendMessage({
    type: MessageType.ANNOTATIONS_UPDATED,
    payload: { annotations, url },
    tabId,
  });
}

// URL 标准化：只保留 origin + pathname
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.origin + u.pathname;
  } catch {
    return url;
  }
}
```

### 4.4 Markdown 工单生成器

**文件：** `src/sidepanel/exporter.ts`

```typescript
export function generateMarkdown(
  annotations: FixItAnnotation[],
  pageUrl: string
): string {
  const header = [
    `# FixIt 修改工单`,
    `页面：${pageUrl}`,
    `导出时间：${new Date().toLocaleString('zh-CN')}`,
    ``,
    `---`,
    ``,
  ].join('\n');

  const items = annotations
    .sort((a, b) => a.sequenceIndex - b.sequenceIndex)
    .map((ann) => {
      const confidenceLabel = {
        'data-attr': '高可靠（data 属性）',
        'id': '高可靠（语义 id）',
        'aria': '高可靠（aria 属性）',
        'name': '高可靠（表单 name）',
        'semantic-class': '中可靠（语义 class）',
        'structural': '低可靠（结构路径，建议自行核实）',
      }[ann.cssSelectorConfidence];

      return [
        `## ${circledNumber(ann.sequenceIndex)} ${ann.userComment.split('\n')[0]}`,
        `**修改要求：** ${ann.userComment}`,
        ``,
        `**元素定位：**`,
        `- CSS Selector：\`${ann.cssSelector}\``,
        `- 定位置信度：${confidenceLabel}`,
        `- XPath 备用：\`${ann.xpath}\``,
        ``,
        `**元素快照：**`,
        `\`\`\`html`,
        ann.htmlSnapshot,
        `\`\`\``,
        ``,
        `---`,
        ``,
      ].join('\n');
    });

  return header + items.join('');
}

// ① ② ③ ... ⑳
function circledNumber(n: number): string {
  const circled = ['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩',
                   '⑪','⑫','⑬','⑭','⑮','⑯','⑰','⑱','⑲','⑳'];
  return circled[n - 1] ?? `(${n})`;
}
```

---

## 五、开发实现规划

### 5.1 开发环境搭建

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 初始化项目
bun init
bun add -d typescript @types/chrome

# 构建
bun run build

# 开发模式（watch）
bun run dev
```

**`package.json` 关键脚本：**

```json
{
  "scripts": {
    "dev": "bun build src/content/index.ts src/background/index.ts src/sidepanel/index.ts --outdir dist --watch",
    "build": "bun build src/content/index.ts src/background/index.ts src/sidepanel/index.ts --outdir dist --minify",
    "typecheck": "tsc --noEmit"
  }
}
```

### 5.2 manifest.json 关键配置

```json
{
  "manifest_version": 3,
  "name": "FixIt",
  "version": "1.0.0",
  "description": "点选网页问题元素，一键生成 AI 修改工单",
  "permissions": [
    "storage",
    "activeTab",
    "scripting",
    "sidePanel"
  ],
  "background": {
    "service_worker": "dist/background/index.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["dist/content/index.js"],
      "run_at": "document_idle"
    }
  ],
  "side_panel": {
    "default_path": "src/sidepanel/index.html"
  },
  "commands": {
    "_execute_action": {
      "suggested_key": { "default": "Alt+F" },
      "description": "激活/关闭 FixIt 标注模式"
    }
  },
  "action": {
    "default_icon": {
      "16": "assets/icons/16.png",
      "32": "assets/icons/32.png"
    },
    "default_title": "FixIt"
  }
}
```

### 5.3 分阶段开发任务

#### Sprint 1：地基（1～2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| 项目初始化 | Bun + TS 配置，manifest.json，目录结构 | P0 |
| CSS Selector 生成器 | 核心定位算法，优先级链完整实现 | P0 |
| XPath 生成器 | 优化截断版 XPath，锚点向上遍历逻辑 | P0 |
| 单元测试 | 针对定位算法编写测试用例，覆盖各类框架的 DOM 结构 | P0 |

> **Sprint 1 的重点是把 CSS Selector 生成器做稳。** 这是整个产品体验的地基，不稳则后续一切都不可信。测试用例要覆盖：styled-components hash class、MUI 动态类名、Vue scoped 属性、无语义 id 的纯结构 DOM。

#### Sprint 2：感知层（1～2 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| Content Script 骨架 | 激活/关闭状态机，快捷键监听 | P0 |
| Shadow DOM 隔离层 | Overlay host 初始化，私有样式注入 | P0 |
| 悬停高亮 | `mouseover` 监听，高亮框跟随，滚动更新 | P0 |
| 批注气泡 | 点选弹窗，输入框，Enter/Esc 交互 | P0 |
| 数字徽章渲染 | 序号标签渲染，位置计算，悬停展示摘要 | P1 |

#### Sprint 3：数据层与中枢（1 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| Storage 封装 | CRUD 操作，URL 标准化，数据迁移兼容 | P0 |
| Background Service Worker | 消息路由，标签页生命周期监听 | P0 |
| 标注持久化联调 | Content Script ↔ Background ↔ Storage 完整链路打通 | P0 |
| 页面刷新后徽章重注入 | 页面加载完成后读取 storage 重新渲染已有标注 | P1 |

#### Sprint 4：展示层与导出（1 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| Side Panel UI | 标注列表渲染，删除交互，全部清空 | P0 |
| 标签页联动 | `onActivated` + `onUpdated` 监听，侧边栏自动刷新 | P0 |
| Markdown 工单生成器 | 完整模板实现，置信度标注 | P0 |
| 剪贴板写入 | `navigator.clipboard.writeText`，成功提示 | P0 |

#### Sprint 5：新手引导与收尾（1 周）

| 任务 | 说明 | 优先级 |
|------|------|--------|
| Playground 页面 | 设计"故意写烂"的模拟页面，三步任务引导 | P1 |
| 通关烟花动画 | 轻量 CSS 动画，无第三方库 | P2 |
| 首次安装触发 | `chrome.runtime.onInstalled` 检测，自动打开 Playground | P1 |
| 插件图标状态 | 激活/未激活视觉区分 | P1 |
| 端到端测试 | 完整 SOP 流程手测，覆盖 localhost 和线上环境 | P0 |
| 打包与发布准备 | `bun run build`，Chrome Store 素材准备 | P0 |

### 5.4 关键技术风险与应对

| 风险 | 严重度 | 应对策略 |
|------|--------|----------|
| 无法生成唯一 CSS Selector | 高 | XPath 副轨兜底；在工单中标注低置信度警告，提示 AI 自行核实 |
| Shadow DOM 与目标页面事件冲突 | 中 | 在 Shadow DOM 内部捕获所有事件，阻止冒泡到宿主页面 |
| SPA 路由切换导致徽章丢失 | 中 | 监听 `popstate` + `MutationObserver`，路由变更后重注入 |
| chrome.sidePanel 在旧版 Chrome 不支持 | 低 | 要求 Chrome ≥ 114（sidePanel API 正式可用版本），在 manifest 中声明最低版本 |
| Service Worker 被浏览器休眠 | 低 | MV3 标准行为，通过 `chrome.storage` 做状态持久化，不依赖 SW 内存状态 |

### 5.5 V2 预留接口

在 `FixItAnnotation` 中预留以下字段（V1 不填写，默认为 `undefined`），V2 启动时直接扩展：

```typescript
// V2 预留字段（当前不填写）
aiRefinedComment?: string;      // AI 润色后的批注
visualDiff?: {                  // V3 视觉微调差值
  property: string;
  from: string;
  to: string;
}[];
```
