---
ownership: shared
version: alpha
name: Ink Studio（墨间）
description: 面向长时间创作场景的安静书房式 UI —— 暖纸底、墨色字、单一赭石点缀
colors:
  # 基底
  background: "#FAF9F7"
  foreground: "#211F1D"
  card: "#FFFFFF"
  card-foreground: "#211F1D"
  popover: "#FFFFFF"
  popover-foreground: "#211F1D"
  overlay: "rgba(33, 31, 29, 0.45)"
  # 主行动色（墨青）
  primary: "#2E4B54"
  primary-foreground: "#F6F4F0"
  primary-hover: "#264048"
  primary-active: "#1F363D"
  # 次级
  secondary: "#EDE9E2"
  secondary-foreground: "#211F1D"
  secondary-hover: "#E5E0D7"
  # 弱化
  muted: "#F1EEE8"
  muted-foreground: "#6B655E"
  # 点缀（赭石）
  accent: "#B4552D"
  accent-foreground: "#FFFFFF"
  accent-soft: "#F3E3DA"
  on-accent-soft: "#9C4823"
  # 语义反馈
  destructive: "#9E3A31"
  destructive-foreground: "#FBF6F3"
  destructive-hover: "#8C332B"
  success: "#3D6B4E"
  success-soft: "#E8F0E9"
  warning: "#7A5A1C"
  warning-soft: "#F7EFDD"
  # 结构
  border: "#E4DFD6"
  input: "#D9D3C8"
  ring: "#2E4B54"
colors-dark:
  background: "#191817"
  foreground: "#EDEAE5"
  card: "#211F1E"
  card-foreground: "#EDEAE5"
  popover: "#262422"
  popover-foreground: "#EDEAE5"
  overlay: "rgba(0, 0, 0, 0.55)"
  primary: "#8FB6C2"
  primary-foreground: "#15262B"
  primary-hover: "#A3C4CE"
  primary-active: "#7FA8B4"
  secondary: "#2C2A27"
  secondary-foreground: "#EDEAE5"
  secondary-hover: "#343128"
  muted: "#2A2826"
  muted-foreground: "#A39C93"
  accent: "#D07A50"
  accent-foreground: "#26120A"
  accent-soft: "#3A2A21"
  on-accent-soft: "#E0A183"
  destructive: "#C96A60"
  destructive-foreground: "#2B0F0C"
  border: "#33302D"
  input: "#3B3733"
  ring: "#8FB6C2"
typography:
  display:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  h1:
    fontFamily: "Noto Serif SC, Songti SC, serif"
    fontSize: 30px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  h2:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.3
  h3:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 17px
    fontWeight: 600
    lineHeight: 1.4
  body-lg:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 17px
    fontWeight: 400
    lineHeight: 1.7
  body-md:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.65
  body-sm:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  label-md:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.01em
  label-sm:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.04em
  caption:
    fontFamily: "Inter, Noto Sans SC, PingFang SC, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  code-sm:
    fontFamily: "JetBrains Mono, Consolas, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: 0px
  xs: 4px
  sm: 6px
  md: 10px
  lg: 14px
  xl: 20px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 24px
  page-margin: 32px
  card-padding: 20px
  section-gap: 48px
  sidebar-width: 264px
  topbar-height: 56px
motion:
  instant: 80ms
  fast: 120ms
  base: 200ms
  slow: 320ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
  easing-enter: "cubic-bezier(0, 0, 0.2, 1)"
elevation:
  low: "0 1px 2px rgba(28, 27, 26, 0.06)"
  mid: "0 4px 16px rgba(28, 27, 26, 0.10)"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
  button-primary-disabled:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-secondary-hover:
    backgroundColor: "{colors.secondary-hover}"
  button-ghost:
    backgroundColor: transparent
    textColor: "{colors.foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 12px
  button-ghost-hover:
    backgroundColor: "{colors.muted}"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.destructive-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-destructive-hover:
    backgroundColor: "{colors.destructive-hover}"
  input-field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0 12px
  input-field-disabled:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    width: 520px
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 22px
    padding: 0 10px
  badge-accent:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.on-accent-soft}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    height: 22px
    padding: 0 10px
  tab-active:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: 32px
    padding: 0 12px
  tab-inactive:
    backgroundColor: transparent
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.sm}"
    height: 32px
    padding: 0 12px
  table-header:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-sm}"
    height: 36px
    padding: 0 12px
  tooltip:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    typography: "{typography.caption}"
    rounded: "{rounded.sm}"
    padding: 6px 8px
  sidebar-item:
    backgroundColor: transparent
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: 36px
    padding: 0 12px
  sidebar-item-hover:
    backgroundColor: "{colors.muted}"
  sidebar-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
  toast:
    backgroundColor: "{colors.foreground}"
    textColor: "{colors.background}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.lg}"
    padding: "{spacing.md}"
---
# Ink Studio（墨间）

> 本文件是本项目 UI 的**单一事实源**。所有组件、页面与 agent 的设计决策以此为准；
> 任何改动先改这里，再运行 `npm run design:sync` 让代码侧自动跟进。

## Overview

参照物：**一本高级文具品牌的产品手册，摊开在安静书房的原木桌上**。纸是略带暖意的
米白，字是研开的墨色，唯一的颜色来自页边的赭石色批注笔。

- 受众与场景：长时间进行写作与创作的用户。界面陪伴用户数小时，第一要务是**不打扰**。
- 情绪目标：安静、可靠、有书卷气。用户注意力属于内容，不属于界面。
- 密度取向：内容区留白呼吸（阅读宽度约束、大段间距）；工具面板与列表紧凑但不逼仄。
- 这套 UI 不追求"惊艳的首屏"。它像一件顺手的文具：第一眼平静，越用越对。

## Colors

暖纸基底 + 墨色前景 + 单一赭石点缀。颜色即语义，代码中禁止出现原始色值。

- **background {colors.background} / foreground {colors.foreground}**：暖纸白与暖墨黑。
  永远不用纯白 `#FFF` 做页面底、纯黑 `#000` 做正文（卡片可用纯白以形成一层"纸上贴纸"）。
- **primary {colors.primary}（墨青）**：唯一的主行动色。一屏至多一个 primary 按钮；
  hover/active 走 {colors.primary-hover} / {colors.primary-active}，不做透明度变换。
- **secondary {colors.secondary} / muted {colors.muted}**：暖石色底纹。secondary 用于
  次级按钮与选中底，muted 用于表头、禁用底、hover 底与骨架屏。
- **accent {colors.accent}（赭石）**：批注笔的颜色，**稀缺即价值**。只允许出现在：
  行内链接、当前项标记（左侧 2px 竖线）、进行中状态点、badge-accent。
  **禁止**用于按钮背景、大面积色块、标题文字。
- **destructive {colors.destructive}**：仅用于不可逆操作（删除、清空、离开未保存页）。
  普通"取消/关闭"不得使用。
- **success / warning**：以 soft 底（{colors.success-soft} / {colors.warning-soft}）
  搭配同名深色文字，只用于状态反馈（badge、行内提示），不用于操作按钮。
- 对比度承诺：正文/组件文字 ≥ 4.5:1，大标题 ≥ 3:1。`design-lint` 会校验组件配对，
  不达标不得合入。

## Typography

两族分工：**衬线（Noto Serif SC）只属于品牌时刻**（display / h1），
其余一律无衬线（Inter + Noto Sans SC）。代码与数据用 JetBrains Mono。

- **display / h1**：页面级标题与空状态主句。衬线字给产品一点书卷气，但每屏至多一处。
- **h2 / h3**：区块与卡片标题，无衬线半粗。h3 与正文同字号（17px），靠字重区分。
- **body-lg**：编辑器与阅读正文（17px / 1.7 行高，中文长文的舒适线）。
- **body-md**：默认界面正文；**body-sm**：辅助说明、表格正文。
- **label-md / label-sm**：按钮、表单标签、导航项。label-sm 全大写场景需 0.04em 字距。
- **caption**：时间戳、字数统计等元信息，永远 {colors.muted-foreground}。
- **code-sm**：代码、ID、快捷键。
- 铁律：一屏至多 **3 种字重**；正文行长 45~75 字符（中文 22~38 字）；
  不允许出现 tokens 之外的字号。

## Layout

约束布局 + 8px 节奏（4px 半步长用于微调，来自 spacing scale）。

- 页面框架：左侧栏 {spacing.sidebar-width}，顶栏 {spacing.topbar-height}，
  内容区页边距 {spacing.page-margin}。
- 阅读/编辑主栏最大宽度 720px；仪表盘与管理页最大 1200px，居中。
- 区块间距 {spacing.section-gap}；卡片网格间隙 {spacing.gutter}；相关表单项间距 {spacing.md}。
- 响应式：≥1280px 双栏（侧栏常驻）；768~1279px 侧栏可折叠为图标栏；<768px 侧栏转抽屉，
  内容单栏，页边距降为 {spacing.md}。
- 空间优先级：宁可滚动，不可拥挤。任何容器内边距不小于 {spacing.sm}。

## Elevation & Depth

层级靠**描边优先，阴影克制**表达——像纸上叠纸，而不是悬浮玻璃。

- Level 0（页面）：background 平铺，无阴影。
- Level 1（卡片）：card 底 + 1px {colors.border} 描边；静态卡片**无阴影**。
- Level 2（可交互卡片 hover / 下拉浮层）：elevation.low（{elevation.low}）。
- Level 3（对话框 / 命令面板）：elevation.mid（{elevation.mid}）+ overlay 遮罩 {colors.overlay}。
- 禁止：三层以上阴影叠加、彩色阴影、内发光。暗色模式下阴影几乎不可见，
  改用更亮的 surface（colors-dark.card）+ 描边表达层级。

## Shapes

圆角有明确档位分工，同一视图相邻元素不混档：

- {rounded.xs} 4px：checkbox、颜色点、进度条端头等微元素。
- {rounded.sm} 6px：输入框、tabs、tooltip、行内代码块。
- {rounded.md} 10px：按钮、列表项、菜单项。
- {rounded.lg} 14px：卡片、面板、toast。
- {rounded.xl} 20px：对话框、命令面板。
- {rounded.full}：badge、头像、开关。
- 图标：lucide 线性图标，2px 描边、圆端点；默认 16px（行内）/ 20px（独立按钮）。
  禁止混入面性/彩色图标库。

## Components

> 组件规格的唯一出处。新组件必须先在本章登记（front matter tokens + 小节 prose），
> 再进入编码 —— 流程见 `devrules/workflows/design-new-component.md`。
> 每个小节按固定八项书写：Anatomy / Variants / Sizes / States / Tokens / Behavior & A11y / Usage / Do & Don't。

### Buttons

- **Anatomy**：容器 + 标签（label-md）+ 可选前置图标（16px，与文字间距 {spacing.sm}）。
- **Variants**（层级从强到弱）：`button-primary` > `button-secondary` > `button-ghost`；
  破坏性操作独立为 `button-destructive`。
- **Sizes**：sm 32px（0 12px 内边距，用于工具条）；md 40px（默认）；lg 48px（营销页/空状态主行动）。
- **States**：default / hover（换 -hover 底色）/ active（-active，无位移无缩放）/
  focus-visible（2px {colors.ring} 环 + 2px 偏移）/ disabled（button-primary-disabled 配色，
  cursor-not-allowed，**不用透明度**）/ loading（左侧 16px spinner，标签保留，禁点）。
- **Tokens**：`button-primary(-hover/-active/-disabled)`、`button-secondary(-hover)`、
  `button-ghost(-hover)`、`button-destructive(-hover)`。
- **Behavior & A11y**：Enter/Space 触发；loading 时 `aria-busy`；图标按钮必须有 `aria-label`。
- **Usage**：一屏一个 primary（对话框内主行动同理）；并排按钮 primary 在右；
  ghost 用于工具条与卡片内低强调操作。
- **Don't**：不得给按钮加渐变、阴影；不得用 accent 做按钮背景；相邻按钮不得混用圆角档。

### Input Fields

- **Anatomy**：标签（label-md，上方，间距 {spacing.xs}）+ 输入容器 + 可选前后图标 +
  帮助/错误文字（caption，下方，间距 {spacing.xs}）。
- **Variants**：单行 input、多行 textarea（min-height 96px）、带前后缀（如 URL 前缀）。
- **Sizes**：md 40px 默认；sm 32px 仅用于密集过滤条。
- **States**：default（1px {colors.input} 描边）/ hover（描边转 {colors.muted-foreground}）/
  focus（描边转 {colors.ring} + 2px ring，同 focus-visible）/ error（描边与帮助文字转
  {colors.destructive}，图标 16px）/ disabled（input-field-disabled 配色）。
- **Tokens**：`input-field(-disabled)`；error/focus 态为描边与文字色变化，底色不变。
- **Behavior & A11y**：label 必须 `for` 绑定；错误用 `aria-invalid` + `aria-describedby`；
  占位符不承载必要信息。
- **Usage**：表单垂直排布，字段间距 {spacing.md}；行内过滤输入可横排。
- **Don't**：不得用占位符代替标签；错误提示不得只用颜色表达（必须有文字/图标）。

### Cards

- **Anatomy**：容器（card token）+ 可选标题行（h3 + 右侧操作区）+ 内容 + 可选底部操作行。
- **Variants**：静态卡（信息展示，无 hover）；交互卡（整卡可点：hover 升 elevation.low
  并且描边转 {colors.input}）；强调卡（左侧 3px accent 竖线，用于"进行中/推荐"）。
- **Sizes**：内边距统一 {spacing.card-padding}；网格间隙 {spacing.gutter}。
- **States**：交互卡 hover / focus-visible（同按钮 ring 规则）/ selected（描边转 {colors.ring}）。
- **Tokens**：`card`；交互态在代码层通过 elevation/border token 表达。
- **Behavior & A11y**：整卡可点时用单一链接语义，内部次级按钮 `stopPropagation`。
- **Usage**：卡片是"一张纸"——一张卡一个主题。
- **Don't**：**禁止卡中嵌卡**；禁止静态卡带阴影；禁止卡片背景用 muted（那是底纹不是纸）。

### Dialogs

- **Anatomy**：overlay（{colors.overlay}）+ 面板（dialog token，宽 520px，移动端全宽减
  {spacing.md}×2）+ 标题（h2）+ 正文（body-md）+ 底部按钮行（右对齐，间距 {spacing.sm}）。
- **Variants**：标准对话框；确认对话框（正文一句话）；危险确认（主行动为 button-destructive，
  且需要输入确认词的场景写明目标名称）。
- **States**：enter 动效 {motion.base} + {motion.easing-enter}（淡入 + 4px 上移）；
  exit {motion.fast}。
- **Tokens**：`dialog`。
- **Behavior & A11y**：焦点陷阱；Esc 关闭（危险确认除外）；关闭后焦点还给触发元素；
  `aria-labelledby` 指向标题。
- **Usage**：对话框只承载**一个决定**；超过一屏内容改用独立页面或抽屉。
- **Don't**：禁止对话框套对话框；禁止无 overlay 的居中弹窗。

### Badges

- **Anatomy**：胶囊容器 + label-sm 文字 + 可选 6px 状态点。
- **Variants**：`badge`（中性，默认）；`badge-accent`（进行中/新内容）；
  success-soft / warning-soft / destructive 底的语义变体（配对深色文字，规则同 Colors 章）。
- **States**：静态元素，无 hover 态；可关闭 badge 附 12px 关闭图标。
- **Tokens**：`badge`、`badge-accent`。
- **Usage**：badge 是元数据不是按钮；一行内不超过 3 枚。
- **Don't**：不得当按钮用（可点的过滤标签是 Chip，用 button-ghost 规格实现）。

### Tabs

- **Anatomy**：轨道（muted 底、{rounded.md} 容器、2px 内边距）+ 平铺 tab 项。
- **States**：`tab-active`（card 白底 + elevation.low，像抽出的卡片）/ `tab-inactive`
  （透明底 muted-foreground 字，hover 转 foreground）/ focus-visible 同全局 ring 规则。
- **Tokens**：`tab-active`、`tab-inactive`。
- **Behavior & A11y**：方向键切换；`role="tablist"` 语义；切换内容区不做动画（内容即时替换）。
- **Usage**：3~6 项平级视图切换；超过 6 项改用下拉或侧导航。
- **Don't**：禁止下划线式与卡片式两种 tab 风格混用（本系统只用卡片式）。

### Tables

- **Anatomy**：表头（table-header token：muted 底 + label-sm 大写）+ 数据行（body-sm，
  行高 44px）+ 行分隔线 1px {colors.border}。
- **States**：行 hover 转 {colors.muted} 底；选中行左侧 2px accent 竖线 + secondary 底；
  空表显示空状态模式（见 States & Feedback）。
- **Tokens**：`table-header`。
- **Usage**：数字列右对齐并使用 code-sm；操作列固定最右，用 button-ghost sm。
- **Don't**：禁止斑马纹与行分隔线同时使用（本系统默认只用分隔线）。

### Tooltips

- **Anatomy**：foreground 深底 + background 浅字（唯一允许的反色元素）+ {rounded.sm}。
- **States**：延迟 400ms 出现，{motion.fast} 淡入；指针移开即时消失。
- **Tokens**：`tooltip`。
- **Usage**：只解释图标按钮或缩写，一行文字以内；承载不下的信息改用 popover。
- **Don't**：禁止在 tooltip 里放链接或按钮。

### Sidebar Navigation

- **Anatomy**：侧栏（background 同页面底 + 右侧 1px border）+ 分组标题（caption 大写）+
  导航项（sidebar-item：16px 图标 + label-md 文字）。
- **States**：`sidebar-item`（默认 muted-foreground）/ `-hover`（muted 底）/
  `-active`（secondary 底 + foreground 字 + 左侧 2px accent 竖线）。
- **Tokens**：`sidebar-item(-hover/-active)`。
- **Behavior & A11y**：当前项 `aria-current="page"`；折叠态只显图标并以 tooltip 显名。
- **Don't**：激活态不得使用 primary 大色块（侧栏必须保持安静）。

### Toasts

- **Anatomy**：foreground 深底反色条（toast token）+ 可选 16px 语义图标 + body-sm 文字 +
  可选单个行动（下划线文字按钮）。
- **States**：右下角进出，enter {motion.base}、exit {motion.fast}；默认 4s 自动消失，
  含行动的 8s；同屏最多 3 条，先进先出。
- **Tokens**：`toast`。
- **Usage**：toast 只报结果（成功/失败），不问问题；需要决定的场景用对话框。
- **Don't**：禁止用 toast 显示表单校验错误（错误就地显示）。

## Do's and Don'ts

- **Do** 一屏至多一个 primary 按钮；主行动永远只有一个。
- **Do** 所有交互元素提供 focus-visible：2px {colors.ring} 环 + 2px 偏移，无例外。
- **Do** 用 spacing scale 的值表达一切间距；用 .typo-* / text-* 语义类表达一切文字。
- **Do** 新设计决策先写进本文件（token + prose），跑 `design:sync` 后再写组件代码。
- **Don't** 代码中出现任何硬编码颜色/字号/间距/圆角（design-guard 强制阻断）。
- **Don't** 使用渐变、玻璃拟态、彩色阴影、内发光 —— 这本手册里没有这些工艺。
- **Don't** 让 accent 出现在按钮背景或大面积色块上；它只是批注笔。
- **Don't** 卡中嵌卡；对话框套对话框。
- **Don't** 同一视图混用两档以上圆角、超过 3 种字重。
- **Don't** 用透明度表达 disabled（用 muted 配色表达）。
- **Don't** 界面中出现功能介绍、技术说明、快捷键海报、占位文案、营销废话 ——
  界面只说用户任务需要的话（空状态一句话引导与 tooltip kbd 除外；逐项标准见
  `devrules/templates/design-acceptance.md`）。

## Motion

动效像合上笔帽：干脆、机械、不炫技。

- {motion.instant} 80ms：颜色/描边变化（hover、按下）。
- {motion.fast} 120ms：tooltip、toast 退出、小元素淡入。
- {motion.base} 200ms：面板/浮层进出、折叠展开，一律 {motion.easing}（进场用 {motion.easing-enter}）。
- {motion.slow} 320ms：仅限布局级变化（侧栏折叠、页面级过渡）。
- 任何动效不得超过 400ms；禁止弹跳、过冲、视差。
- 骨架屏 shimmer 1.2s 线性循环，是唯一允许的无限动画。
- `prefers-reduced-motion: reduce` 时所有时长归零（即时切换），shimmer 停止。

## States & Feedback

- **Loading**：内容列表 >300ms 未返回显示骨架屏（muted 底，形状按最终布局占位）；
  按钮内操作用行内 spinner（见 Buttons）；禁止全屏 loading 遮罩。
- **Empty**：图标（24px muted-foreground）+ 一句话说明（body-md）+ 一个主行动
  （button-primary 或 secondary）。空状态是引导，不是尽头。
- **Error**：表单错误就地显示（见 Input Fields）；操作失败用 toast + 明确的重试行动；
  页面级错误用空状态模式 + 返回/重试。
- **Success**：轻反馈优先——toast 一句话；不打断流程，不弹对话框庆祝。

## Dark Mode

暗色是"熄了大灯的书房"，不是另一套设计。

- token 层：front matter 的 `colors-dark` 组同名覆盖，`design-sync` 自动生成 `.dark`
  作用域变量；组件代码零改动。
- 不变式：primary 在暗色下转为浅墨青 {colors-dark.primary}（深底上的可读主色），
  层级由阴影表达改为 surface 提亮 + 描边（见 Elevation 章）。
- 禁止纯黑背景（用 {colors-dark.background} 暖黑）；禁止暗色下的高饱和大色块；
  正文对比度同样 ≥ 4.5:1。
