---
ownership: shared
# ============================================================================
# DESIGN.md 母版模板 —— 复制到项目根命名为 DESIGN.md，逐节替换后运行：
#   npm run design:lint   校验    npm run design:sync   生成 token 产物
# 说明：
#   - 下方是「最小可用」的合法 front matter，值都是待替换示例。
#   - token 是数值事实；正文 prose 才是设计本身（理由、用法、边界）。
#   - 颜色值必须加引号（YAML 中 # 开头会被当注释）。
#   - 不支持数组；组件状态用 -hover/-active/-disabled 等后缀键表达。
# ============================================================================
version: alpha
name: 替换为你的设计系统名
description: 一句话描述这套 UI 的气质与适用产品
colors:
  # 语义命名（推荐对齐 shadcn 语义位：background/foreground/primary/secondary/
  # muted/accent/destructive/border/input/ring...），而不是 blue-500 这类原始名
  background: "#FFFFFF"
  foreground: "#111111"
  primary: "#111111"
  primary-foreground: "#FFFFFF"
  muted: "#F4F4F4"
  muted-foreground: "#666666"
  border: "#E5E5E5"
  ring: "#111111"
  destructive: "#B3261E"
  destructive-foreground: "#FFFFFF"
typography:
  # 9~15 个级别为宜；命名 = 语义类别 + 尺寸（display/h1/h2/body-lg/body-md/label-sm/caption...）
  h1:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
    lineHeight: 1.6
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0.04em
rounded:
  sm: 6px
  md: 10px
  lg: 14px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 24px
  page-margin: 32px
# 自定义扩展组（motion/elevation/zindex...）会被 design-sync 生成为 --<组名>-<键> 变量
motion:
  fast: 120ms
  base: 200ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
components:
  # 每个组件 = 一组 token（引用为主，少写字面量）。状态用后缀键。
  # design.config.json 的 lint.requiredComponents 定义了本项目必须登记的组件清单。
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.md}"
    height: 40px
    padding: 0 16px
  button-primary-hover:
    backgroundColor: "{colors.primary}"
  input-field:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    height: 40px
    padding: 0 12px
---
# <设计系统名>

<!-- 本文件是项目 UI 的单一事实源：所有组件、页面、agent 的设计决策都以此为准。
     写法三原则（来自 DESIGN.md 官方哲学）：
     1. 具体参照物 > 形容词堆砌：「1970 年代老牌大学的研究生讲义」胜过「现代、简洁、高级」。
     2. 负向约束定义气质：明确写出这套 UI 永远不做什么。
     3. token 给数值，prose 给理由：没有理由的数值撑不过三次迭代。 -->

## Overview

<!-- 必填（输入来自 devrules/workflows/design-read.md 的定调结论）。回答五件事：
     1. 产品类型定调：SaaS/后台（克制高密度可扫描）/ 消费品牌（真实视觉资产与情绪）/
        工具编辑器（效率与状态反馈优先）？可混合但写明主基调。
     2. 参照物：这套 UI 像什么具体的实物/场景？（一句话，可被想象）
     3. 受众与场景：谁在什么状态下使用？（专注创作？碎片浏览？后台管理？）
     4. 情绪目标：用户应当感到什么？（安静可靠 / 轻快活泼 / 克制专业）
     5. 密度取向：信息密集型还是留白呼吸型？依据是使用频率与核心任务。 -->

## Colors

<!-- 必填。为每个色 token 写清：语义角色 + 使用边界。
     推荐结构：
     - **background / foreground**：页面基底与正文，说明为什么是这个色温。
     - **primary**：唯一的主行动色。写明「一屏最多出现几处」。
     - **muted / secondary**：次级信息与底纹的分工。
     - **accent**（如有）：点缀色只允许出现在哪些位置。
     - **destructive / success / warning**：语义反馈色的触发条件。
     - 对比度承诺：正文 ≥ 4.5:1，大字 ≥ 3:1（design-lint 会校验组件配对）。 -->

## Typography

<!-- 必填。写清：字体族的分工（标题/正文/代码）、每个级别的角色、
     中西文混排规则（如有）、字重上限（一屏最多几种字重）、大小写与字间距规则。 -->

## Layout

<!-- 布局模型（栅格 or 约束布局）、间距节奏（基于 spacing scale 的 4/8px 韵律）、
     容器最大宽度、页面框架（侧栏宽度、顶栏高度）、响应式断点策略。 -->

## Elevation & Depth

<!-- 层级如何表达：阴影 or 描边 or 色阶。写明每一层（页面/卡片/浮层/弹窗）用什么，
     以及禁止事项（例如「禁止叠加超过两层阴影」）。 -->

## Shapes

<!-- 圆角语言：rounded scale 中每一档分别用于什么元素；禁止混用的规则。
     图标风格（线性/面性、描边宽度、圆角端点）也写在这里。 -->

## Components

<!-- 必填，也是本文件最重要的章节：组件设计细节的唯一出处。
     每个组件一个 ### 小节，按下面 8 项写全（模板见 devrules/templates/design-component-spec.md）：

     1. Anatomy 结构：由哪些部分组成（容器/图标/标签/辅助文字）
     2. Variants 变体：有哪些变体，层级关系（primary > secondary > ghost）
     3. Sizes 尺寸：sm/md/lg 的高度、内边距、字号（对应 token）
     4. States 状态矩阵：default / hover / active / focus-visible / disabled / loading / error
     5. Tokens：front matter components.* 里对应的键名清单
     6. Behavior & A11y：键盘操作、aria 角色、focus ring 规则
     7. Usage 使用规则：什么时候用哪个变体；反例
     8. Do / Don't：本组件的专属禁令

     新组件必须先在这里登记规格（front matter tokens + 本章节 prose），
     再进入编码 —— 流程见 devrules/workflows/design-new-component.md。 -->

### Buttons

<!-- 示例小节骨架，按上面 8 项填写。 -->

### Input Fields

### Cards

### Dialogs

## Do's and Don'ts

<!-- 必填。负向约束是这套 UI 的「宪法」，宁少勿泛，每条都要具体可判定：
     - **Don't** 禁止出现第二种主行动色 / 渐变 / 玻璃拟态 /（写你自己的）
     - **Don't** 禁止在同一视图混用两档以上圆角
     - **Do** 一屏最多一个 primary 按钮
     - **Do** 所有交互元素必须有 focus-visible 样式（ring token）
     另外三条通用铁律建议保留：
     - **Don't** 在代码中出现任何硬编码颜色/字号/间距（design-guard 强制）
     - **Don't** 界面中出现功能介绍/技术说明/快捷键海报/占位文案/营销废话
       （真实产品律，见 rules/design-agent-rules.md；tooltip kbd 与空状态一句话引导除外）
     - **Do** 所有新设计决策先写入本文件再实现（devrules 工作流强制） -->

## Motion

<!-- 扩展章节（规范允许自定义章节）。写清：动效时长档位与缓动的使用场景、
     什么元素永远不动、prefers-reduced-motion 的降级策略。 -->

## States & Feedback

<!-- 扩展章节。全局状态模式：loading（骨架屏 or spinner 的选择规则）、
     empty（空状态插画/文案/主行动）、error（行内 vs toast vs 页面级）、
     成功反馈（toast 时长、位置）。 -->

## Dark Mode

<!-- 扩展章节（如适用）。写明暗色策略：
     - token 层：在 front matter 增加 colors-dark 组（同名键覆盖），design-sync 会生成 .dark 作用域变量；
     - 语义不变式：foreground/background 翻转后，primary 的辨识度如何保持；
     - 禁止事项：如「禁止纯黑 #000 背景」。 -->
