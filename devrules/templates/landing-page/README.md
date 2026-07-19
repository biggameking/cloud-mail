---
title: Landing Page Template Library
description: Index and extension contract for evidence-based, conversion-focused landing-page structure templates.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
last_reviewed: 2026-07-17
---

# Landing Page Template Library

本目录存放 Landing Page 的**结构与内容决策模板**。它不提供可直接复制的品牌视觉，
不包含虚构文案、假数据或项目实现代码。使用入口是
`devrules/workflows/landing-page.md`，真实性边界由
`devrules/rules/landing-page.md` 负责。

## 快速使用

1. 按本轮范围使用 `brief.md` 建立必要的转化契约、Evidence Brief、Claim Ledger 与消息架构。
2. 选择结构路径：`registered_template`、`custom`、`brief_only` 或 `not_applicable`。
3. 只有选择 `registered_template` 时，才根据受众认知、Offer、证明资产和销售路径选择一个已登记模板。
4. 只保留有购买决策价值且有真实输入的模块；把所选结构与项目设计系统和技术栈结合后实现。

模板不应反过来决定产品定位、定价、功能、客户证明或导航。填不出的模块不是“待生成
内容”，而是需要补证据、改顺序或删除的信号。

## 当前模板

| Template ID | 文件 | 适用场景 | 不适用场景 |
| --- | --- | --- | --- |
| `saas-conversion` | `saas-conversion.md` | B2B/SaaS、Product-led 试用/注册或 Sales-led 预约演示；需要从价值到证据再到风险处理的长页。 | 单一活动报名、极短 waitlist、内容文章、登录后产品页、没有复杂购买判断的简单下载页。 |

当前只有一个已验证的结构模板。它是显式候选，不是默认值。未来模板必须作为独立文件
加入本索引；不得把尚未存在的模板名称写成可用选项，也不得让 `saas-conversion` 自动成为所有页面的默认值。
没有适配候选时，`custom`、`brief_only` 和
`not_applicable` 都是有效结果。

## 选择问题

选择模板前回答：

- 访客已经知道问题、解决方案类别，还是已经在比较产品？
- Primary Conversion 是自助注册、试用、购买、下载、预约演示还是候补名单？
- Offer 是否需要解释迁移、集成、安全、价格或销售流程？
- 有哪些可公开的指标、客户、评价、演示、案例和政策证据？
- 访客需要在页面内完成判断，还是页面只负责进入下一步咨询？
- 现有品牌和页面模式要求怎样的节奏、媒体和信息密度？

模板与以上答案不匹配时，使用 `brief.md` 自定义模块序列，或按任务范围记录
`brief_only` / `not_applicable`；不要为了复用模板而扭曲真实购买路径。

## 验收归属

项目/任务决定是否采用质量评分、模板模块完整性、独立文案评审、SEO、分析或设计治理，
以及对应的验收证据。模板库不设置通用分数，也不因未选择某个模板或模块判定失败。
进入发布内容的声明仍必须遵守 Claim Ledger 的真实性边界。

## 模块契约

每个结构模板必须把页面拆成可组合模块，并为每个模块声明：

| 字段 | 要求 |
| --- | --- |
| `purpose` | 推动哪个购买信念或解决哪个疑问。 |
| `required_inputs` | 需要哪些产品事实、内容或资产。 |
| `allowed_evidence` | 可使用的证据类型与必要限定。 |
| `presence` | `required`、`conditional` 或 `optional`。 |
| `omit_when` | 哪些情况下删除，而不是填充。 |
| `copy_prompt` | 结果、机制、证据和 CTA 的写法提示。 |
| `interaction` | 锚点、表单、媒体、FAQ、切换等真实行为。 |
| `adjacency` | 为什么放在前后模块之间，可否移动。 |

模板可以给出推荐顺序，但必须允许根据认知阶段、证据强度和 Offer 调整。Logo、指标、
Integrations、Reviews 和 Pricing 默认都是条件模块，除非模板和项目证据证明它们必需。

## 新模板准入

新增模板时：

1. 说明独立的转化场景，不能只是 `saas-conversion` 换标题或换颜色；
2. 使用同一模块契约和 Claim Ledger 规则；
3. 给出至少一条不适用边界与删除条件；
4. 不携带具体项目的 URL、客户、指标、价格、文案、品牌 token 或私有资产；
5. 更新本索引、`templates/README.md`、工作流路由和 Landing Page self-test；
6. 声明 `ownership`、`activation`、`enforcement`、`decision_owner` 与
   `side_effects`，并按共享模板发布与同步规则处理。

## 与其他模板的边界

- `templates/design-read.md`：视觉与交互定调，不负责 Offer 或营销证据。
- `templates/design-page-spec.md`：页面实现规格，不负责模板选择与 Claim Ledger。
- `templates/design-acceptance.md`：通用 UI 验收，不负责转化和声明真实性。
- `templates/ui/`：登录后产品与管理界面模式，不是 Landing Page 模板。
- 本目录：转化目标、消息顺序、证据驱动的营销模块和发布真实性。

Last updated: 2026-07-17
