---
title: SaaS Conversion Landing Page
description: Modular B2B/SaaS landing-page structure derived from a high-converting long-page reference, with evidence and omission rules for every section.
ownership: shared
governs: product
activation: explicit
enforcement: example
decision_owner: project
side_effects: none
template_id: saas-conversion
last_reviewed: 2026-07-17
---

# Template · SaaS Conversion Landing Page

本模板把用户提供的 High Converting SaaS Landing Page 参考图抽象为可组合的转化叙事。
它保留模块职责和推荐顺序，不保存原图路径、灰色占位内容、固定文案、视觉风格或具体尺寸。
使用前先完成 `brief.md`，并遵守 `rules/landing-page.md`。

本文件仅在项目/用户把 Structure path 显式选择为 `registered_template` 且选择
`saas-conversion` 后生效。文件存在、Landing Page 路由命中或模板库只有这一个候选，
都不构成自动选择。模板内的 `Required` 只表示“选择本模板后的结构契约”，不是所有
Landing Page 的通用要求。

## 适用条件

适合同时满足多数条件的页面：

- 面向明确的 B2B/SaaS ICP；
- Offer 是试用、注册、购买或预约演示；
- 用户需要理解价值、机制、采用成本、差异和风险后才行动；
- 产品能展示真实界面、工作流、证明或明确边界；
- 页面需要承载 Product-led 或 Sales-led 的完整判断链。

以下场景不要套用：极短 waitlist、单一活动报名、内容文章、登录后产品界面、没有足够
信息支撑长页、或用户只要求复刻另一个明确视觉来源。

## 转化叙事

推荐让访客依次确认：

```text
相关性 → 价值 → 机制 → 证据 → 采用方式 → 差异 → 兼容性 → 社会证明
→ 成本与风险 → 异议解除 → 行动
```

这是默认认知顺序，不是固定 DOM 顺序。高认知访客可以提前看到 Pricing；高风险企业
购买可以把 Security/Proof 放在 How It Works 后；证据薄弱时应缩短页面，而不是增加空区块。

## 模块总览

| # | Module ID | Presence | 主要疑问 | 缺失时处理 |
| --- | --- | --- | --- | --- |
| 1 | `decision-nav` | Conditional | 我能快速验证哪些购买信息？ | 短页可省略锚点，只保留品牌与 CTA。 |
| 2 | `hero` | Required | 这是给我的吗，能带来什么，下一步是什么？ | 不能省略；信息不清则返回 Brief。 |
| 3 | `value-visual` | Conditional | 产品价值在真实使用中是什么样？ | 无真实演示时用经验证的工作流说明或删掉，不放装饰截图。 |
| 4 | `association-proof` | Conditional | 像我这样的团队是否信任它？ | 无授权 Logo/采用证据时删除。 |
| 5 | `outcome-grid` | Required | 它具体怎样改善我的工作和结果？ | 不能只改名为 Features；必须有能力→变化→结果。 |
| 6 | `quantitative-proof` | Conditional | 价值是否可衡量？ | 无可靠指标时删除或换成可验证案例。 |
| 7 | `how-it-works` | Conditional | 上手、部署或获得价值需要什么？ | 流程极简单时在 Hero/Outcome 内说明即可。 |
| 8 | `why-us` | Conditional | 为什么选它而不是当前替代方案？ | 无真实差异时返回定位，不制造比较。 |
| 9 | `integrations` | Conditional | 它是否适配现有工具与数据流？ | 无真实集成或不是购买障碍时删除。 |
| 10 | `testimonials` | Conditional | 真实用户是否获得过类似结果？ | 无授权评价/案例时删除。 |
| 11 | `pricing` | Conditional | 是否适合预算，总成本和边界是什么？ | Sales-led 可改为资格/方案说明；不得虚构套餐。 |
| 12 | `objection-faq` | Conditional | 哪些风险、限制和下一步仍不清楚？ | 关键异议必须在其他区块已回答才可省略。 |
| 13 | `final-cta` | Required | 我已判断完，如何立即行动？ | 不能省略，且与 Hero 主行动一致。 |
| 14 | `trust-footer` | Required | 公司、政策和联系方式是否真实可信？ | 不能省略真实法律与联系入口。 |

## 1 · Decision Nav

- **purpose**：让高意向访客快速跳到验证信息，并持续看到 Primary CTA。
- **required_inputs**：品牌入口、4–6 个真实页面锚点、CTA 目标。
- **allowed_evidence**：不需要营销声明；导航名称必须与可见区块一致。
- **presence**：长页或多判断模块时使用。
- **omit_when**：页面很短，锚点比内容更复杂。
- **copy_prompt**：用访客问题命名，例如 Product、How it works、Pricing、Customers、FAQ；
  不用内部产品模块名。
- **interaction**：锚点可键盘操作，滚动后目标不被 sticky header 遮挡；移动端菜单可关闭。
- **adjacency**：Hero 之前；CTA 与全页主行动语义一致。

## 2 · Hero

- **purpose**：首屏建立相关性、结果、可信度和行动方向。
- **required_inputs**：ICP、触发场景、核心结果、差异化机制、CTA 下一步、至少一项可信线索。
- **allowed_evidence**：Claim Ledger 中 `Verified` / `Qualified` 的微型证明。
- **presence**：Required。
- **copy_prompt**：
  - Eyebrow：受众、场景或已验证社会证明；
  - H1：结果或工作状态改变，不写品类空口号；
  - Subhead：受众 + 痛点 + 机制 + 必要边界；
  - Primary CTA：动词 + 真实动作/所得；
  - Secondary CTA：观看演示、查看案例等低承诺验证；
  - Microcopy：信用卡、响应时间、演示时长或后续步骤，必须真实。
- **interaction**：CTA 可执行；表单若在首屏，覆盖 loading/error/success 和隐私说明。
- **adjacency**：紧接 value visual 或最强证明，不用无关装饰隔断。

## 3 · Value Visual

- **purpose**：让访客看见“获得价值的关键时刻”，证明文案对应真实产品。
- **required_inputs**：真实产品状态、演示数据边界、媒体资产、隐私审查。
- **allowed_evidence**：生产截图、可验证 demo、经批准的交互演示或真实工作流动画。
- **presence**：产品价值可被视觉证明时使用。
- **omit_when**：只能展示空后台、开发界面、敏感数据或与承诺无关的装饰画面。
- **copy_prompt**：Caption 解释用户完成了什么，不解说内部实现。
- **interaction**：视频提供控制、字幕/替代信息和 poster；图片有合适 alt，设备上不裁掉关键内容。
- **adjacency**：Hero 之后，帮助用户从承诺进入具体机制。

## 4 · Association Proof

- **purpose**：降低“像我这样的团队是否会采用”的疑虑。
- **required_inputs**：授权 Logo、真实关系类型、适用受众相似性。
- **allowed_evidence**：客户、合作伙伴、集成生态或媒体引用必须标明真实关系。
- **presence**：有足够且相关的公开证明时使用。
- **omit_when**：无授权、关系含糊、只有不相关大品牌或数量不足以表达真实模式。
- **copy_prompt**：说明“客户/合作伙伴/兼容平台”的具体关系，不用笼统 Trusted by。
- **interaction**：Logo 若链接必须指向真实案例/来源；无意义时保持非交互。
- **adjacency**：可放在 Hero/value visual 后，也可在 Outcome 前作为信任桥梁。

## 5 · Outcome Grid

- **purpose**：把产品能力翻译为客户任务、工作变化和结果。
- **required_inputs**：Top JTBD、真实能力、使用场景、结果证据或可验证机制。
- **allowed_evidence**：产品事实、演示、案例、研究；结果数字仍需 Claim Ledger。
- **presence**：Required，通常 3–5 个结果组。
- **copy_prompt**：每项使用“当 `[场景]` 时，通过 `[能力/机制]` 完成 `[工作]`，从而
  获得 `[结果]`”；标题写结果，正文解释机制。
- **interaction**：媒体与文字一一对应；不要用四张同权重卡片填版式却没有优先级。
- **adjacency**：在 Hero/Proof 后建立价值主体；可按最重要 JTBD 排序。

## 6 · Quantitative Proof

- **purpose**：把核心承诺变为可衡量证据。
- **required_inputs**：3–4 个直接相关指标、指标名、基线、样本、周期、方法和限定。
- **allowed_evidence**：`Verified` / `Qualified` 数据及公开口径。
- **presence**：证据足够且指标帮助购买判断时使用。
- **omit_when**：只能得到虚荣指标、孤立百分比或无法公开口径。
- **copy_prompt**：数值 + 指标名 + 样本/时间 + 限定；不写没有分母的“提升 55%”。
- **interaction**：需要解释时链接方法/案例；动画数字尊重减少动效且不改变最终值。
- **adjacency**：Outcome 后证明结果，或紧随相关案例。

## 7 · How It Works

- **purpose**：降低学习、实施、迁移和首次价值时间的不确定性。
- **required_inputs**：真实用户流程、输入、产物、依赖和时间边界。
- **allowed_evidence**：当前产品流程与已验证实施实践。
- **presence**：Offer 或上手过程需要解释时使用，通常 3–4 步。
- **copy_prompt**：每步写“动作动词 + 用户输入/动作 → 立即得到的进展”；只有证据支持时
  承诺分钟、小时或天数。
- **interaction**：步骤图、demo 或 progressive disclosure 不得隐藏必要限制。
- **adjacency**：在价值与差异之间，证明产品不是黑盒承诺。

## 8 · Why Us

- **purpose**：解释为何当前机制比替代方式更适合目标 ICP。
- **required_inputs**：替代方案、选择条件、独特机制、适用/不适用边界、比较日期。
- **allowed_evidence**：公开产品事实、验证研究、当前竞争资料和案例。
- **presence**：访客存在明确替代方案或比较阶段时使用。
- **omit_when**：只有“更快、更智能、更简单”而没有机制或来源。
- **copy_prompt**：相比 `[替代方式]`，通过 `[独特机制]` 帮助 `[ICP]` 获得 `[结果]`，
  尤其适合 `[条件]`。
- **interaction**：比较表必须可读、条件对称、来源可访问；不得伪装成中立排名。
- **adjacency**：How It Works 后说明结构性优势，也可在 Pricing 前减少比较焦虑。

## 9 · Integrations

- **purpose**：证明无需破坏现有工作流即可采用。
- **required_inputs**：真实集成清单、状态、方向、数据/事件、权限、限制和文档链接。
- **allowed_evidence**：当前 native、Beta、third-party automation 或 manual import 能力。
- **presence**：兼容性是购买障碍或差异化因素时使用。
- **omit_when**：只有 Logo 墙却无法说明真实数据流，或集成仍只是路线图。
- **copy_prompt**：说明 `[A]` 的 `[数据/事件]` 如何进入 `[B]`，帮助完成 `[结果]`。
- **interaction**：Logo/条目链接到真实文档；状态和限制对键盘与屏幕阅读器可见。
- **adjacency**：差异之后、社会证明之前，回答采用摩擦。

## 10 · Testimonials

- **purpose**：由相似客户证明问题、采用过程和结果。
- **required_inputs**：授权原话或经确认编辑稿、姓名、职位、公司、场景、来源和日期。
- **allowed_evidence**：公开评价、批准案例、可核验的视频或采访。
- **presence**：有与 ICP 和核心结果相关的真实证言时使用。
- **omit_when**：需要代写、拼接、生成头像/公司、匿名到无法建立可信度或结果不相关。
- **copy_prompt**：原问题 → 采用产品 → 具体改变 → 可验证结果；保留必要限定。
- **interaction**：轮播不是默认；若使用必须可暂停、键盘操作且不隐藏关键信息。
- **adjacency**：Integrations/Outcome 后加强可信度，Pricing 前降低购买风险。

## 11 · Pricing

- **purpose**：让访客判断适配性、总成本、限制和下一步。
- **required_inputs**：真实套餐、适用对象、价格、币种、周期、席位、用量、超额、税费、
  合同、试用、退款、取消和 CTA。
- **allowed_evidence**：当前公开定价、正式报价政策或批准的 sales-led 资格说明。
- **presence**：自助购买、价格透明或用户明确需要初步预算判断时使用。
- **omit_when**：价格不公开且页面不能提供可靠范围；此时改为方案/资格说明，不造套餐。
- **copy_prompt**：按客户阶段、用量或结果分层；“Most popular”需真实采用数据，否则写
  “推荐给 `[具体团队]`”。
- **interaction**：月/年切换必须更新所有金额、单位和节省口径；CTA 与套餐状态一致。
- **adjacency**：证明与差异之后；FAQ 之前处理成本异议。

## 12 · Objection FAQ

- **purpose**：在疑虑成为退出理由前直接回答。
- **required_inputs**：真实销售、支持、研究或行为证据中的优先异议及准确答案。
- **allowed_evidence**：产品、政策、合同、实施、安全和支持事实。
- **presence**：仍有关键异议未在主叙事回答时使用。
- **omit_when**：所有关键异议已在相关区块清楚回答，且 FAQ 只会重复卖点。
- **copy_prompt**：先给直接结论，再给条件、限制和来源；优先适配、效果、实施、风险、
  成本、取消与下一步。
- **interaction**：Accordion 可键盘使用、状态可感知、深链不失效；关键答案不依赖 JS 才可抓取。
- **adjacency**：Pricing/Proof 后、Final CTA 前，完成风险处理。

## 13 · Final CTA

- **purpose**：让完成判断的访客无需滚回顶部即可行动。
- **required_inputs**：核心结果、Primary CTA、下一步说明、真实风险缓解信息。
- **allowed_evidence**：只使用 Ledger 中已批准声明。
- **presence**：Required。
- **copy_prompt**：重述结果 + 同一 Primary CTA + 点击后步骤；不要引入新 Offer 或新承诺。
- **interaction**：CTA、表单和错误/成功状态与 Hero 相同；不使用虚假紧迫感。
- **adjacency**：FAQ/最后证明后，Footer 前。

## 14 · Trust Footer

- **purpose**：完成公司、联系、政策和合法性验证。
- **required_inputs**：真实公司身份、联系入口、产品/资源链接、隐私政策、条款和必要合规入口。
- **allowed_evidence**：当前法律和公司资料。
- **presence**：Required。
- **copy_prompt**：简洁准确，不用 Footer 再做一次功能营销。
- **interaction**：链接有效、焦点可见、外链语义明确；版权年份和公司名真实。
- **adjacency**：页面末尾。

## Sales Motion Variants

### Product-led

- Primary CTA：注册、开始试用或购买；清楚说明信用卡、试用期和限制。
- Pricing 通常保留并可在导航出现。
- How It Works 强调首次价值，表单字段最少。
- Secondary CTA 可是观看短 demo 或查看案例。

### Sales-led

- Primary CTA：预约演示、联系销售或获取方案；说明时间、参与者和响应承诺。
- Pricing 可改为适用规模、方案范围或资格说明，不能虚构公开套餐。
- Testimonials、Security/Proof、Integrations 和实施边界可能前移。
- Secondary CTA 可是看案例、看产品导览或下载有真实价值的材料。

## Responsive And Accessibility Notes

- 移动端按购买信念顺序单列，不机械保持桌面卡片栅格。
- Nav、Pricing table、Logo row、对比表和评价不得造成横向溢出或不可访问轮播。
- CTA 热区至少符合项目平台标准，focus-visible、键盘顺序和错误提示完整。
- H1、数字、客户名、套餐名、中英混排和 2–10 倍长文案必须不破版。
- 图片/视频在小屏仍保留价值关键内容；无法保留时改用专门移动资产或文字证据。
- 动画、自动播放、滚动效果和数字计数尊重 `prefers-reduced-motion`，不得延迟核心内容。

## Template-specific Acceptance

- [ ] Hero、Outcome、Final CTA 和 Footer 存在且各自职责明确。
- [ ] 其余模块都有证据和购买决策理由；缺少证据的模块已删除。
- [ ] Outcome 写结果与机制，不是内部功能目录。
- [ ] 每个数字包含指标名与口径，没有孤立百分比。
- [ ] Logo、评价、集成、套餐和政策与 Claim Ledger 一致。
- [ ] 一个 Primary Conversion，Hero/Nav/Pricing/Final CTA 的主行动语义一致。
- [ ] Product-led / Sales-led 路径与真实后续步骤一致。
- [ ] 桌面与移动端都保持完整购买信念顺序和可访问交互。
- [ ] 页面使用项目品牌和真实资产，没有把结构参考误当成默认视觉样式。

Last updated: 2026-07-17
