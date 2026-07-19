---
ownership: shared
version: 1.0.0
name: Signal Newsroom / 信号编辑部
description: 高信号编辑部风格：衬线阅读层级、暖纸底、克制分隔线与唯一新闻红点缀
colors:
  background: "#FAF9F6"
  foreground: "#1A1A1A"
  card: "#FFFFFF"
  card-foreground: "#1A1A1A"
  popover: "#FFFFFF"
  popover-foreground: "#1A1A1A"
  primary: "#171A2F"
  primary-foreground: "#FAFAFA"
  primary-hover: "#232844"
  secondary: "#F1EFEA"
  secondary-foreground: "#262626"
  secondary-hover: "#E8E5DE"
  muted: "#F4F2ED"
  muted-foreground: "#68645E"
  accent: "#DC2626"
  accent-foreground: "#FFFFFF"
  accent-hover: "#B91C1C"
  destructive: "#B42318"
  destructive-foreground: "#FFFFFF"
  destructive-hover: "#941F15"
  border: "#DDD9D1"
  input: "#CDC8BE"
  ring: "#171A2F"
colors-dark:
  background: "#10121A"
  foreground: "#EAEAEA"
  card: "#181B26"
  card-foreground: "#EAEAEA"
  popover: "#1E2230"
  popover-foreground: "#EAEAEA"
  primary: "#EAEAEA"
  primary-foreground: "#171A2F"
  primary-hover: "#FFFFFF"
  secondary: "#242735"
  secondary-foreground: "#E4E4E4"
  secondary-hover: "#2E3242"
  muted: "#222531"
  muted-foreground: "#A9A9AD"
  accent: "#EF4444"
  accent-foreground: "#170909"
  accent-hover: "#F87171"
  destructive: "#F87171"
  destructive-foreground: "#1E0909"
  destructive-hover: "#FCA5A5"
  border: "#343846"
  input: "#444958"
  ring: "#D6D7DA"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.08
    letterSpacing: -0.025em
  h1:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 38px
    fontWeight: 700
    lineHeight: 1.14
    letterSpacing: -0.018em
  h2:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.012em
  h3:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: 21px
    fontWeight: 700
    lineHeight: 1.28
  body-lg:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 18px
    fontWeight: 400
    lineHeight: 1.8
  body-md:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.7
  body-sm:
    fontFamily: "Source Serif 4, Georgia, serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.55
  label-md:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0.055em
  label-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 11px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.085em
  caption:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
rounded:
  none: 0px
  xs: 3px
  sm: 4px
  md: 6px
  lg: 10px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
  3xl: 64px
  gutter: 24px
  page-margin: 32px
  section-gap: 48px
motion:
  fast: 120ms
  base: 200ms
  slow: 400ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
elevation:
  low: "0 1px 2px rgba(23, 26, 47, 0.06)"
  raised: "0 8px 24px rgba(23, 26, 47, 0.12)"
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
    rounded: "{rounded.sm}"
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
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  dialog:
    backgroundColor: "{colors.card}"
    textColor: "{colors.card-foreground}"
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    width: 520px
  badge:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.xs}"
    height: 22px
    padding: 0 8px
  badge-accent:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.xs}"
    height: 22px
    padding: 0 8px
---

# Signal Newsroom / 信号编辑部

## Overview

这是一套面向新闻、分析、叙事出版与编辑型知识产品的高信号设计语言。具体参照物是周末报纸的头版与一间持续更新的数字编辑部：标题有作者立场，正文适合长读，导航和时间信息像校对标记一样准确。用户既会快速扫读，也会进入 5–15 分钟的专注阅读，因此层级依赖字体角色、图片尺度、栅格跨度和细分隔线，而不是卡片数量。

情绪目标是可信、及时、克制而有编辑判断。默认信息密度中高；内容之间留出呼吸，但不使用消费品牌式的大面积空白。适用于公共阅读界面，不自动延伸到后台管理、数据图谱或营销活动页。

## Colors

- `background` 是带轻微暖度的纸面，承载连续阅读；`foreground` 是近黑墨色，避免纯黑白的刺眼反差。
- `primary` 是深夜编辑部蓝，只用于高信号带、主要操作和需要稳定权威感的结构；它不是第二种装饰色。
- `accent` 是唯一新闻红，仅用于分类、当前导航、live/breaking 状态、关键链接与少量行动。一屏最多一个大面积红色行动，其余只作文字或细线信号。
- `secondary` / `muted` 区分可交互的次级表面与静态弱化信息；卡片默认白色，只在内容确需独立边界时出现。
- `destructive` 只表达不可逆操作，不承担新闻紧急程度。正文与背景对比度至少 4.5:1，大标题至少 3:1。
- 暗色模式保持语义不变，以蓝黑而非纯黑为底；红色提亮但缩小使用面积，长文仍用柔和浅灰而非纯白。

## Typography

Playfair Display 只承担出版身份：刊头、故事标题和主要章节标题。Source Serif 4 负责摘要与长文，阅读栏保持 60–68ch。Inter 负责导航、作者、时间、分类、按钮、输入和系统状态；它不能取代故事正文。

分类与元数据可用全大写和正字距，但仅限短标签；句子、正文和长标题保持自然大小写。一个视图最多同时出现三个主要字重。中文环境下应选择气质相近、可读性验证过的宋体/黑体 fallback，并保持“标题衬线、正文衬线、UI 无衬线”的角色分工。

## Layout

桌面公共页面使用最大约 1280px 的 12 列栅格，24px gutter。头条通常占 8 列，次级故事占 4 列；后续列表可降为 4 列或 2 列。长文主体脱离宽栅格，限制在 60–68ch，元数据和分享工具放在正文外沿而不挤压行长。

区块间距以 48px 为主，标题到内容用 16–24px。移动端先保留故事优先级，再将列自然折叠；不得简单缩小桌面字号或保留横向拥挤的新闻栏。图片裁切服务于内容焦点，头条可使用较宽画幅，列表缩略图保持一致比例。

## Elevation & Depth

页面层级优先靠纸面色阶、1px 分隔线、图片叠色和空间建立。普通故事块无阴影；`low` 只用于需要从纸面脱离的控件，`raised` 只用于弹窗、浮层或明确的 hover 提升。禁止卡中卡和连续三层阴影。

深蓝高信号带可以形成结构深度，但同一视图最多一个主导深色区域。图片上的文字必须有实测可读的遮罩，不允许只依赖文字阴影补救低对比素材。

## Shapes

3–6px 小圆角用于标签、按钮、输入和缩略图，10px 只给弹窗或明显独立的浮层。故事卡片不得使用大胶囊圆角；`full` 仅用于圆形图标按钮、头像和状态点。分隔线保持细直，圆角不能破坏报刊式栅格的对齐感。

图标采用简洁线性风格，默认 1.5–2px 描边，和 Inter 元数据同色。禁止混用厚实卡通图标、彩色 emoji 与正文编辑层级。

## Components

### Buttons

Primary、secondary、ghost、destructive 的层级固定。常规高度 40px，文字使用 `label-md`；primary 一屏最多一个，accent 版本只在订阅或即时跟进等明确编辑行动中使用。所有按钮覆盖 hover、active、focus-visible、disabled 与 loading；loading 保持原宽，focus 使用 `ring`。

### Input Fields

输入框使用纸面卡色、细边框和 4px 圆角，不使用厚重填充或悬浮胶囊。标签位于输入框外，帮助文字只解释用户数据格式或后果。错误在字段附近用 destructive 语义呈现；键盘焦点清晰且不以颜色为唯一线索。

### Cards

故事默认不需要卡片：图片、标题、摘要、元数据和分隔线已经构成内容单元。只有可独立操作、跨背景或需要明确边界的模块才用 `card`。卡片不能套卡片，hover 最多使用轻微位移或 `low` 阴影，并为 reduced motion 关闭位移。

### Dialogs

Dialog 只用于必须阻断当前操作的确认、登录或短表单，宽度约 520px，10px 圆角。标题保持 UI 层级而非夸张故事标题；初始焦点、Esc、焦点锁定和关闭后焦点恢复必须完整。

### Badges and Editorial Signals

普通 badge 使用 `secondary`，分类、live 或 breaking 信号可使用 `badge-accent`。标签文字为短全大写 `label-sm`；不得把正文句子塞入 badge，也不得同时出现多种竞争性彩色标签。Ticker 是可选模式，必须可暂停，并在 reduced motion 下停止连续滚动。

## Do's and Don'ts

- **Do** 先用字体角色、图片尺度、栅格跨度和细线建立编辑优先级。
- **Do** 让真实标题、摘要、作者、日期和分类决定组件密度，并用长短极端内容验收。
- **Do** 把新闻红限制为当前、紧急或可行动的信号，保持纸面与墨色占主导。
- **Do** 所有交互元素提供 focus-visible，Ticker 与 hover 位移尊重 reduced motion。
- **Don't** 把页面做成“每条内容一个圆角阴影卡片”的后台仪表盘。
- **Don't** 使用渐变品牌底、玻璃拟态、霓虹描边、大胶囊容器或装饰性 emoji。
- **Don't** 在代码中硬编码颜色、字号或间距；新增决策先登记到目标项目的 DESIGN.md。
- **Don't** 复制来源项目的名称、路由、业务文案、管理后台样式或图表色板。
- **Don't** 出现功能说明、技术机制、占位文案、快捷键海报或空泛营销话术。

## Motion

颜色和边框反馈使用 120ms，普通状态转换 200ms，图片或内容入场上限 400ms。动效表达状态变化和阅读方向，不为标题或正文持续制造注意力。Ticker 必须提供停止机制；`prefers-reduced-motion` 下移除滚动、位移和自动播放，仅保留必要的瞬时状态反馈。

## States & Feedback

列表 loading 使用与真实标题行、图片比例一致的骨架，不用全页 spinner。Empty 状态只给一句与当前筛选相关的解释和一个合理行动。Error 优先靠近失败区域，跨页面故障才使用页面级状态；成功反馈简短，不覆盖正在阅读的正文。

断网或内容延迟时保留已加载故事和时间信息，禁止以假内容填满版面。图片失败要保持版式尺寸并提供中性底色或真实替代文本；标题极长、无图片、无摘要、突发标签叠加等情况都必须经过响应式验收。

## Dark Mode

暗色使用蓝黑页面与略亮卡面，维持纸张层级而不反转成纯黑霓虹界面。图片遮罩、边框和 muted 文本需单独校验；红色不因暗底而扩大面积。用户选择应持久化，并在首屏渲染前生效以避免闪烁。
