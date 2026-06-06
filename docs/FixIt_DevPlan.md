# FixIt 开发计划 (TODO)

**版本：** V1.0
**最后更新：** 2026-06-06
**配套文档：** [PRD](FixIt_PRD.md) · [技术文档](FixIt_TechDoc.md)

> 本文档以可勾选 TODO 形式拆分 V1 全部开发任务。技术栈在原技术文档基础上做了一处升级：
> **构建工具由手写 `bun build` 脚本升级为 WXT（基于 Vite 的 MV3 扩展框架）**，其余架构 / 数据结构 / 算法完全沿用原文档。

---

## 技术栈（已定）

- **框架：** WXT（Vite 内核，MV3 原生、HMR、多入口、manifest 自动生成）
- **包管理 / 运行时：** Bun（回退方案：npm）
- **语言：** TypeScript（strict）
- **UI：** 原生 TS + CSS（不引前端框架）
- **测试：** Vitest + happy-dom
- **规范：** ESLint + Prettier
- **工具：** `crypto.randomUUID()`、自研 CSS Selector 优先级链算法

### 已决断的设计点（开工默认值）
- [ ] **D1 交互**：action `onClicked`（含 Alt+F）里同时「切换标注模式」+「`chrome.sidePanel.open()` 打开面板」
- [ ] **D2 构建**：交给 WXT，不再手写拷贝/改写脚本
- [ ] **D3 测试**：定位算法用 Vitest + happy-dom 跑无头 DOM
- [ ] **D4 隔离**：Shadow DOM 用 `closed` 模式，shadow 内事件 `stopPropagation` 防冒泡污染宿主
- [ ] **补充**：存量徽章重定位失败时标记为「失联」而非静默丢弃

---

## Sprint 0 — 工程初始化

- [ ] `git init` 并建 `.gitignore`（`.output/`、`.wxt/`、`node_modules/`）
- [ ] `bun create wxt@latest`（vanilla + TypeScript 模板）；Bun 受阻则回退 npm
- [ ] 配置 `tsconfig.json` 为 strict
- [ ] 接入 ESLint + Prettier，加 `lint` / `format` 脚本
- [ ] 接入 Vitest + happy-dom，加 `test` 脚本
- [ ] 按技术文档 §2.2 建目录骨架（`entrypoints/` 映射 content/background/sidepanel/playground，`src/shared`、`src/content/locator`）
- [ ] `wxt.config.ts` 配置 manifest：`permissions`(storage/activeTab/scripting/sidePanel)、`side_panel`、`commands._execute_action`(Alt+F)、`minimum_chrome_version: "114"`、`action`
- [ ] 跑通 `dev`：加载已解压扩展，确认空壳能装载
- [ ] **验收**：`typecheck` / `lint` / `test`(空) / `dev` 全部可运行

---

## Sprint 1 — 地基与双轨定位算法【重点】

- [ ] `src/shared/types.ts`：`FixItAnnotation`（含 V2 预留可选字段 `aiRefinedComment?` / `visualDiff?`）、`MessageType` 枚举、`Message<T>`
- [ ] `src/content/locator/css-selector.ts`
  - [ ] `GENERATED_CLASS_PATTERN` + `isSemanticClass`
  - [ ] `isSemanticId`（排除哈希特征 id）
  - [ ] `isUnique`（`querySelectorAll().length === 1`，try/catch）
  - [ ] 6 级优先级链：data-attr → id → aria → name → semantic-class → structural
  - [ ] `buildStructuralSelector`（向上最多 3 层，从最近稳定锚点拼路径）
  - [ ] 返回 `{ selector, confidence }`
- [ ] `src/content/locator/xpath.ts`
  - [ ] `findStableAncestor`（向上找含 id 或 data-* 的祖先）
  - [ ] `buildRelativeXPath` / `getAnchorXPathExpr`
  - [ ] `buildAbsoluteXPath`（无锚点兜底，尽量带属性过滤）
- [ ] **单元测试**（地基可信度的关键）
  - [ ] styled-components hash class
  - [ ] MUI 动态类名
  - [ ] Vue scoped 属性（`data-v-xxx`）
  - [ ] 无语义 id 的纯结构 DOM
  - [ ] data-testid / 语义 id / aria / name 命中各级置信度
  - [ ] XPath 锚点截断与绝对路径兜底
- [ ] **验收**：`bun test` 全绿、`typecheck` 无错

---

## Sprint 2 — 感知层（Content Script）

- [ ] `entrypoints/content`：激活/关闭状态机，监听 background 的 toggle 消息
- [ ] `src/content/overlay.ts`：`FixItOverlay`（closed shadow + 私有样式注入到 `documentElement`）
- [ ] 悬停高亮 `src/content/highlighter.ts`
  - [ ] `mouseover` 监听（节流）+ `getBoundingClientRect`
  - [ ] 品牌色 2px 实线高亮框
  - [ ] `scroll` / `resize` 跟随更新位置
- [ ] 批注气泡
  - [ ] 点选元素原地弹出输入框
  - [ ] Enter 确认 / Esc 取消
  - [ ] shadow 内事件 `stopPropagation`
- [ ] 数字徽章
  - [ ] 序号 ①②③ 渲染 + 位置计算
  - [ ] 悬停展示批注摘要
  - [ ] 点击进入编辑/删除
- [ ] 点选确认后调用双轨定位 + 截取 `htmlSnapshot`(≤500 字符)，组装 `FixItAnnotation`
- [ ] **验收**：任意网页点选→批注→落徽章，宿主样式零污染

---

## Sprint 3 — 数据层与中枢（Background + Storage）

- [ ] `src/shared/messages.ts`：消息类型集中定义
- [ ] `src/shared/storage.ts`
  - [ ] `normalizeUrl`（origin + pathname）
  - [ ] key 规范 `fixit:{url}`
  - [ ] CRUD 封装（按 `createdAt` 排序）
- [ ] `entrypoints/background`
  - [ ] 消息路由（Content Script ↔ Side Panel）
  - [ ] ADD / UPDATE / DELETE / CLEAR_ALL 调度
  - [ ] action `onClicked`：toggle 标注 + `sidePanel.open()`（D1）
  - [ ] `tabs.onActivated` / `tabs.onUpdated` 通知侧栏刷新
- [ ] 全链路联调：点选 → ADD_ANNOTATION → 写 storage → 广播 ANNOTATIONS_UPDATED
- [ ] 刷新重注入：`document_idle` 读 storage，存量标注重新定位补徽章
  - [ ] 重定位失败标记「失联」
- [ ] SPA 兜底：`popstate` + `MutationObserver` 路由变更后重注入
- [ ] **验收**：刷新 / 重启 / 切路由后标注与徽章状态正确，无网络请求

---

## Sprint 4 — 展示层与导出（Side Panel）

- [ ] `entrypoints/sidepanel/index.html` + `index.ts`
- [ ] `renderer.ts`：列表项（序号徽章 / 定位摘要 / 批注 / 删除）
- [ ] 单条删除 + 全部清空
- [ ] 标签页联动：监听 `ANNOTATIONS_UPDATED`，切 tab 自动刷新
- [ ] `exporter.ts`：按 PRD §2.1 模板生成 Markdown
  - [ ] 置信度中文标签映射
  - [ ] `circledNumber`（①…⑳ 兜底 `(n)`）
- [ ] 「复制 AI 工单」按钮：`navigator.clipboard.writeText` + 2 秒成功提示
- [ ] **验收**：复制出的工单与 PRD 模板逐字一致

---

## Sprint 5 — 新手引导与收尾

- [ ] `entrypoints/playground/index.html` + `index.ts`：故意写烂的模拟页面
- [ ] 侧边三步任务浮层（提交按钮 / 错位标题 / 复制工单）
- [ ] 通关检测 + 纯 CSS 烟花动画（无第三方库）
- [ ] `runtime.onInstalled` → 自动打开 playground
- [ ] 图标激活/未激活态（`action.setIcon` / badge）
- [ ] 准备 16/32/48/128 图标
- [ ] **E2E 手测**：localhost + 线上各跑一遍完整 SOP
- [ ] **性能抽测**：激活 <100ms / 面板 <200ms / 写入 <50ms
- [ ] `build` 产出可上架 dist + Chrome Store 素材
- [ ] **验收**：dist 可直接「加载已解压扩展」，引导闭环可通关

---

## 全局完成定义 (Definition of Done)

- [ ] 全程零网络请求、零登录、零配置
- [ ] 所有注入 UI 经 Shadow DOM，宿主页面零样式/功能污染
- [ ] 定位算法单测覆盖四大框架 DOM 全绿
- [ ] 完整 SOP（唤醒→点选→批注→导出→投喂）跑通
- [ ] V2 字段在数据结构中预留但不填写
- [ ] `typecheck` / `lint` / `test` / `build` 全部通过
