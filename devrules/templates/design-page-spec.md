---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
页面规格 / Screen Spec —— devrules/workflows/design-new-page.md 与
design-refactor-existing-project.md 的页面级前置产物。
前置门禁：产品架构 applicability 为 required 时，其 verdict 已通过；页面视角的
Design Read 已完成（workflows/design-read.md）。
页面 = 现有原语的组合。本表的核心是「组件清单」：清单里出现任何未登记组件，
必须先走 design-new-component.md 完成登记，页面开发才能继续。
本表随 PR 提交（放 docs/pages/<page>.md 或贴 PR 描述），不合入 DESIGN.md；
若页面催生了新的全局模式（新组件/新 token/新规则），那部分必须写回 DESIGN.md。
============================================================================ -->

# Screen Spec：<页面名 / 路由>

## Design Read 摘要（前置门禁）
<粘入 workflows/design-read.md 的页面视角结论：一句话定位 / 核心任务 Top3 / 密度定调 /
参考产品的具体做法 / 设计语言主基调。填不出来 = 先回去走 design-read，本表无效。>

## 基础信息
- product_ia_baseline:
- product_readiness_artifact:
- surface_id:
- screen_name:
- product_domain:
- surface_role: <primary_destination / secondary_destination / contextual_action / setting>
- capability_ids:
- flow_ids:
- decision_ids:
- file_path / route:
- refactor_mode: <none / incremental / hybrid / full_redesign>
- entry_points:
- exit_paths:

## 页面目的与任务
- purpose:
- primary_task（只能有一个，动词开头）:
- secondary_tasks:
- success_definition（用户完成该页的标志）:

## 布局骨架
- 框架：<沿用全局框架（侧栏+顶栏）？还是聚焦模式（如编辑器全屏）？>
- 主栏宽度：<720px 阅读栏 / 1200px 工作台（引用 DESIGN.md Layout 的约束）>
- 区块划分：<自上而下列出区块，及区块间距（{spacing.section-gap} 等 token）>

## 内容块（P1/P2/P3）
| Block | Priority | Purpose | Component | Content Summary | Interactions |
|---|---|---|---|---|---|
| <block_id> | P1 | <服务 primary_task> | <DESIGN.md 组件键名> | <真实内容摘要> | <用户动作> |

## 组件清单（全部来自 DESIGN.md Components）
| 区块 | 组件（DESIGN.md 键名/小节） | 变体/尺寸 | 备注 |
|---|---|---|---|
| <头部> | button-primary | md | 本页唯一 primary |
| <列表> | card / table-header | - | - |
| <缺口> | ⚠ <未登记组件> | - | 先走 design-new-component.md 登记 |

## 页面状态
- Loading：<骨架屏结构（对齐 States & Feedback 章）>
- Empty：<空状态文案 + 主行动>
- Error：<错误呈现方式>
- Success：<成功反馈与下一步>
- 权限/降级：<如适用>
- Offline / No results / Long content：<如适用>

## 行动优先级
- Primary CTA（唯一）:
- Secondary actions:
- Destructive actions:

## 响应式
<各断点的布局变化，对齐 DESIGN.md Layout 的断点策略；只写本页特有的部分。>

## 保留 / 改动 / 禁止改动
- What to keep:
- What to change:
- What not to change（业务逻辑、API、数据模型、导航等受保护项）:

## 风险与回退
- risks:
- rollback_plan:
- 如果本页审核不通过，回退到：<Design Read / IA / Screen Spec / Component / Visual>

## 完成门禁
- [ ] 组件清单中无未登记组件（或已完成登记）
- [ ] primary_task 唯一，首屏直接服务 primary_task
- [ ] surface、CAP、FLOW 与 DEC ID 和产品/IA 基线一致，没有私自新增入口或改变 scope
- [ ] P1/P2/P3 内容块优先级明确，无技术说明或文档式堆叠
- [ ] 本页只有一个 primary 行动（DESIGN.md Do's and Don'ts）
- [ ] `npm run design:guard` 无 error（含 no-placeholder-copy 无未处置命中）
- [ ] Loading / Empty / Error / Success 至少四态不倒退
- [ ] What not to change 中的受保护边界未被 UI 工作顺手修改
- [ ] Rollback plan 可执行
- [ ] 新增的全局模式已写回 DESIGN.md 并记录 DESIGN-CHANGELOG.md
- [ ] 逐项通过 devrules/templates/design-acceptance.md
