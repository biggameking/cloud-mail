---
description: Create, review, or refactor a conversion-focused landing page from verified product evidence, a project-selected structure path, and project-owned acceptance boundaries.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: local
---

# Landing Page Workflow

本流程是 Landing Page 工作的外层编排入口。它负责项目理解、证据边界、转化目标、
结构路径决策、营销文案协作和项目选定的验收；产品架构、Design Read、新页面施工、
存量 UI 重构、SEO 和分析仍由项目已启用的专门工作流负责。本流程只向下路由，下游
工作流不得反向调用本流程。

## 触发与排除

适用于：

- 新建或重构 Landing Page、marketing page、产品官网首页、发布页、活动转化页；
- 优化 Hero、Offer、CTA、定价、评价、FAQ 或整页转化叙事；
- 把 PRD、现有产品和营销证据转成可实现的公开页面；
- 基于结构参考图创建页面，但仍需适配项目品牌、内容与技术栈。

不适用于：

- 登录后的产品工作台、设置、列表、编辑器或普通功能页；
- 文档、帮助中心、博客文章或纯 SEO 内容页；
- 单个产品组件且不承担营销转化；
- Paywall、结账或应用内购买流程本身，它们应走 commerce/RevenueCat 等流程。

## 输入

- 明确的目标项目或仓库，以及它的官方 Agent 入口和本地 devrules 实例；
- PRD、产品 brief、研究、发布记录、生产页面或其他产品事实源；
- 现有 Landing Page、设计稿、截图或结构参考（重构/匹配时）；
- `DESIGN.md`、品牌资产、组件库、页面实现和分析事件；
- 客户、评价、指标、集成、价格、政策与合规证据；
- Primary Conversion 以及点击后真实发生的步骤。

若目标项目不明确，且不同项目会得到实质不同的内容或实现，不得凭工作区猜测。

## 执行路径

| Lane | 适用范围 | 必需产物 | 实现路由 |
| --- | --- | --- | --- |
| `quick_copy` | 已有定位和结构，只改一小组 Hero、CTA、FAQ 或短文案。 | 受影响字段的简版 Brief；本次声明的 Claim Ledger；结构路径结论。 | 项目已启用时使用 `design-change.md`，否则走项目本地文案路径。 |
| `new_page` | 新建整页或新增主要营销区块。 | 适用字段的 Brief、显式结构路径、页面结构与文案规格（若本轮实现）。 | 达到项目设计治理触发条件时，Design Read → `design-new-page.md`。 |
| `structural_refactor` | 存量页面的叙事、区块顺序、视觉或转化路径需要重构。 | 当前页审计、适用字段的 Brief、保留/改动边界和结构差异。 | 达到项目设计治理触发条件时，Design Read → `design-refactor-existing-project.md`。 |
| `review_only` | 只审核页面、声明、转化路径或结构，不授权实现。 | 审核证据、Claim 风险、结构路径结论和项目可执行建议。 | 无实现路由。 |

不要把一次标题微调升级成整页仪式，也不要把整页重构伪装成 `quick_copy` 来绕过证据、
设计和回归验证。

## Step 1 · 建立项目与产品事实

按目标仓库的 devrules 读取顺序和本轮声明范围检查适用事实源：

1. 项目官方入口和 `devrules/always-readme.md`；
2. 仅当项目启用时，读取 project profile、README anchors 或其他本地上下文表面；
3. 与本轮定位和声明相关的 PRD、产品/IA 基线、用户研究、发布说明和当前生产行为；
4. 与页面承诺相关的代码、功能开关、权限、套餐限制和已上线状态；
5. 与本轮视觉/实现边界相关的当前页面、品牌、`DESIGN.md`、组件和真实资产；
6. 只有当声明或项目验收涉及它们时，读取客户证明、指标口径、价格、集成、政策、
   合规、SEO 或分析事实源。

未被项目 profile/config 选择的上下文表面缺失时记录 `N/A`，不得为了执行 Landing Page
流程自动创建 memory、README anchors、设计治理、SEO 或分析系统。

PRD 是意图证据。准备写成“现在可用”的能力还必须有当前实现或正式发布证据。
发现 PRD、生产行为和营销页面冲突时先记录冲突，不得自动挑选最有利于营销的版本。

### 产品架构门禁

只有当本次工作定义或改变产品能力、领域、核心导航、广泛用户旅程、surface 所有权
或可见状态时，`product-architecture-review.md` 的 applicability 才是 `required`。

- verdict 为 `blocked`：停止结构和文案施工，只能继续收集证据或修正产品输入。
- verdict 为 `ready` / `ready_with_reversible_assumptions`：页面只消费已批准结论。
- 已有产品定位和能力不变、只做营销表达：记录 `not_required` 理由，不重复产品门禁。

## Step 2 · 锁定转化契约

在决定结构路径和写文案前明确：

- Primary audience / ICP：谁在什么触发场景访问；
- Primary Conversion 或有意设计的转化组合：若存在多受众、多入口或分流，明确优先级、
  适用条件和各自衡量方式；
- Offer：用户采取行动后具体得到什么；
- Primary CTA：标签、目标 URL/动作、后续步骤、时间、信用卡或销售介入要求；
- Secondary CTA：说明它与主要行动或分流策略的关系；
- 成功定义：业务转化事件与用户完成标志；
- 非目标受众、非目标行动和本轮不承诺的能力。

若这些字段互相矛盾，先解决 Offer 与转化路径，不用视觉和文案掩盖冲突。

## Step 3 · 建立 Evidence Brief 与 Claim Ledger

使用 `templates/landing-page/brief.md`。`new_page`、`structural_refactor` 填写所有适用
字段并允许明确的 `N/A`；`quick_copy` 和 `review_only` 只填写受影响的受众、Offer、
CTA、消息、声明与验收边界。

Claim Ledger 可以作为任务/PR 证据维护，不强制每个项目永久提交；但发布前必须可供
评审核对。每项声明记录来源、状态、允许措辞、限定条件、负责人和核验时间。

执行 `rules/landing-page.md` 的 `Verified` / `Qualified` / `Planned` / `Unsupported`
规则。以下模块缺证据时默认省略，而不是伪造：

- 客户 Logo 和采用规模；
- 数字指标和 ROI；
- Integrations；
- Reviews / Testimonials；
- Pricing、试用、退款和取消承诺；
- 安全、合规、SLA、排名、奖项和竞争对比。

## Step 4 · 决定结构路径

先读 `templates/landing-page/README.md`，然后根据本轮任务选择并记录一个结构路径：

- `registered_template`：项目显式选择模板库中的已登记模板；只有这一路径才打开模板文件，
  并记录 template id、选择理由、模块顺序、删除/增加项及与现有页面的差异；
- `custom`：根据 Brief、证据和现有项目模式定义项目特定模块序列，不需要登记模板；
- `brief_only`：本轮在事实、受众、Offer、声明或 CTA 澄清处停止，不产出完整页面结构，
  也不启动实现工作流；
- `not_applicable`：局部审阅、文案修改或现有页面已有足够结构时，记录为何结构选择不适用。

`templates/landing-page/saas-conversion.md` 仅在项目显式选择
`registered_template` + `saas-conversion` 时生效。模板库只有这一个候选、文件被同步到
项目或 Landing Page 路由命中，都不能自动选择它。

## Step 5 · 产出消息架构与营销文案

先写一句页面核心消息：

> 为 `[ICP]` 在 `[触发场景]` 中，通过 `[差异化机制]` 获得 `[可验证结果]`，
> 而无需 `[旧方案的主要摩擦或代价]`。

页面顺序应让目标访客依次相信：

1. 这是为我和当前场景准备的；
2. 它解决的是值得行动的问题；
3. 我理解它如何产生结果；
4. 我相信它已经或能够兑现；
5. 切换、购买和使用风险可控；
6. 我知道点击 CTA 后会发生什么。

### 营销评审角色契约

项目可按任务风险、页面价值和既有评审流程，选择营销/转化专家、指定负责人或主 Agent
完成文案评审；devrules 不强制独立专家，也不规定备选文案数量。使用额外评审角色时，
向其提供项目与 PRD 摘要、ICP/JTBD、Offer、差异化机制、证据包、Claim Ledger、
主要异议、品牌语气、禁用词、CTA 路径和本轮结构路径。

评审应返回项目需要的主版本、真正有策略价值的备选（如有）、区块目的、所用证据和
仍需确认的事实。任何角色都不得创造新事实；主执行 Agent 对照 Ledger 完成最终事实
核验，并按项目验收决定是否需要额外批判性复审。

## Step 6 · 形成页面规格并实现

### Design Read 与施工路由

- `brief_only`：在 Brief 和事实边界处停止，不自动启动设计或实现。
- `review_only`：输出审核结论，不修改页面。
- `not_applicable`：保留现有结构；只有本轮仍授权实现时，才按实际改动范围选择项目
  本地施工路径。
- `new_page`：当项目已启用设计治理且本轮达到其触发条件时，完成页面视角 Design
  Read，再用 `design-page-spec.md` 和 `registered_template` 或 `custom` 路径形成
  Screen Spec，随后运行 `design-new-page.md`。
- `structural_refactor`：先审计当前页面和转化路径；当项目设计治理适用时再完成 Design
  Read 并使用 `design-refactor-existing-project.md`，保留其受保护边界和回退策略。
- `quick_copy`：结构、产品事实和视觉方向不变时，按项目配置走 `design-change.md` 或
  本地文案更新路径。

Landing Page workflow 是上游入口；上述工作流只承担自己的设计或施工职责，不应
再次路由回 Landing Page workflow。

### 实现约束

- 优先复用项目路由、布局、tokens、组件、图标库和真实资产；
- 结构参考默认只约束信息顺序，不自动覆盖项目品牌与设计语言；
- 保持 CTA 目标、表单业务规则、分析事件、SEO 路由和已有外部契约，除非需求明确改变；
- 本轮使用 Hero visual 时，展示用户获得价值的关键时刻，不用装饰性后台截图或假数据；
- 本轮涉及的 FAQ、锚点导航、表单、价格切换、媒体和 CTA 必须具有真实可用状态；
- 按实际组件和项目验收处理表单错误、资源失败、长文本、移动端和减少动效行为。

## Step 7 · 接入发现与测量

当项目的公开发现策略与路由条件适用时，执行 `seo-optimization.md` 的技术与内容检查；
不以自然搜索为目标的页面，只按项目发布契约处理 metadata、分享预览和语义化内容，
不要为了满足通用清单填充无价值段落。

分析只复用项目已启用的事件与隐私边界。按页面目标选择适用事件，常见候选包括：

- Landing Page view；
- Primary CTA click；
- 表单 start / success / error 或等价转化漏斗；
- Secondary CTA（如有）；
- 实验 variant（只有真实运行实验时）。

没有分析系统或本轮不包含埋点时记录 `N/A`，不得因此新建外部服务。埋点名称、属性和
隐私策略由项目本地规范决定；重构不得静默删除仍属现有契约的事件。

## Step 8 · 验证与发布门禁

### 真实性

- 每项数字、Logo、评价、价格、集成、比较、政策和当前能力可追溯到 Ledger；
- `Qualified` 的限定语仍在，`Planned` 明确标注，`Unsupported` 未进入发布内容；
- 草稿标记、Lorem、假头像、假公司、灰块和占位链接为零。

### 转化叙事

- 按项目选定的可理解性方法验证首屏受众、结果、差异化/可信线索和行动方向；“5 秒测试”
  可以是项目选择的启发式，不是 devrules 的固定门槛；
- 所有主要区块推动同一购买信念链，删除没有决策价值的模块；
- 单一主要转化或有意分流的优先级清楚，CTA 文案与点击后的真实步骤一致；
- 关键异议在离开页面前得到直接、诚实且有证据的回答。

### 设计与实现

- 运行与改动边界相称的项目原生 formatter/lint/typecheck/tests/build 和适用 design checks；
- 按目标设备、无障碍标准和任务验收验证响应式、长文本、键盘、focus-visible、对比度和触控；
- 对本轮涉及的 CTA、链接、表单、导航、FAQ、媒体和错误状态做可重复验证；
- 只有当视觉来源是本轮验收依据时，才用项目选定 viewport 并排比较并复核；
- metadata、canonical、可抓取正文、结构化数据、性能和分析事件只检查项目适用项，
  其余记录 `N/A`。

### 质量评分

`templates/landing-page/brief.md` 的质量表是可选自评提示。项目决定是否使用、如何计分、
阈值和发布 verdict；devrules 不设固定总分或单项分数。评分不能覆盖 Claim Ledger 的
真实性边界，也不能把未选择的结构、SEO、分析或设计治理变成隐含要求。

开始实现前优先复用项目已有 done criteria；若项目未定义额外门槛，则以本轮明确授权的
产物、可追溯声明、真实可执行交互和与改动相称的验证证据作为验收，不自行扩张范围。

## 输出

- 与本轮范围相称的 Landing Page Brief 与 Claim Ledger；
- 结构路径结论；仅 `registered_template` 输出 template id 和模块差异；
- 经证据复核的页面文案，以及项目认为有价值的备选（如有）；
- Design Read、Screen Spec、存量页面审计或 `N/A`（按 Lane 和项目路由）；
- 若授权实现，提供实现与项目原生检查证据；
- 对项目选定的真实性、交互、响应式、可访问性、SEO、性能和分析验收项分别给出结果或 `N/A`。

## 记忆与事实源

- 只有当项目启用持久记忆或明确要求记录时，项目定位、批准声明、品牌语气或稳定转化
  约束才进入项目本地事实源；
- 单次 Campaign、实验、页面草稿和 Claim Ledger 默认留在任务/PR 证据中；
- 项目启用演进反馈时，可跨项目复用的新模板结构先写 evolution suggestion，经评审后
  再进入共享模板；
- 不把客户私有数据、未公开指标、合同、名单或评价原文写入共享 devrules。

Last updated: 2026-07-17
