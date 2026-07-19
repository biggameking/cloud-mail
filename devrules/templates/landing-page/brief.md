---
title: Landing Page Evidence And Conversion Brief
description: Operating form for grounding landing-page structure and copy in verified product, audience, offer, and proof evidence.
ownership: shared
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

# Landing Page Brief：<项目 / 页面 / Campaign>

> 使用 `devrules/workflows/landing-page.md`。完整页面填写适用字段并允许明确的 `N/A`；
> `quick_copy`、`brief_only` 或局部审阅只填写 §0、§2、§3、§6、§9 和受影响区块。
> Claim Ledger 可以留在任务或 PR 证据中，不强制永久提交，但发布前必须可供核验。

## 0. 范围与执行路径

- Target repository / project:
- Page / route:
- Lane: <quick_copy / new_page / structural_refactor / review_only>
- Page status: <new / draft / production>
- Primary market / locale:
- Owner:
- Review date:
- Product Architecture applicability: <required / not_required>
- Applicability reason:
- Product readiness artifact / verdict: <path + ready / ready_with_reversible_assumptions / N/A>
- Design Read / Screen Spec / current-page audit / N/A:
- Structure path: <registered_template / custom / brief_only / not_applicable>
- Selected template id: <only for registered_template; otherwise N/A>
- Structure/template decision reason:

## 1. Product Truth Packet

### Product proposition

- 一句话产品定义：
- 当前已上线的核心能力：
- 套餐、权限、地域、平台或成熟度边界：
- 明确未上线、Beta、Planned 或本轮不承诺的能力：
- 用户完成价值的关键时刻：

### Sources

| Source | Type | What it proves | Current as of | Owner / confidence |
| --- | --- | --- | --- | --- |
| <path / URL / production evidence> | <PRD / code / release / UI / policy / research> | <fact> | <date/version> | <owner/high-medium-low> |

> PRD 证明意图；“当前可用”还需代码、生产行为、正式发布或负责人确认等当前证据。
> 证据冲突写在下表，不自动选择更有营销效果的一方。

| Conflict / unknown | Sources in conflict | User impact | Resolution owner | Blocks publish? |
| --- | --- | --- | --- | --- |

## 2. Conversion Contract

- Primary audience / ICP:
- Trigger situation:
- Awareness stage: <problem-aware / solution-aware / product-aware / comparison-ready>
- Primary Conversion（如有多条，注明优先级与分流）:
- Offer（采取行动后具体得到什么）:
- Primary CTA label:
- CTA target / action:
- 点击后的真实步骤：
- 需要的时间、信用卡、销售沟通或其他承诺：
- Secondary CTA（如有）及不与主 CTA 竞争的理由：
- User success definition:
- Business conversion event:
- Non-audience / non-goals:

## 3. Audience And JTBD Evidence

- 使用者、购买者、决策者和阻碍者是否相同：
- 当前替代做法：
- 触发购买或切换的事件：
- 最高代价的痛点：
- 痛点造成的业务、时间、风险或情绪后果：
- 用户希望获得的工作状态或结果：
- 成功标准及其证据：
- 用户原话、研究或支持反馈来源：
- 不能从当前证据判断的内容：

核心消息草案：

> 为 `[ICP]` 在 `[触发场景]` 中，通过 `[差异化机制]` 获得 `[可验证结果]`，
> 而无需 `[旧方案的主要摩擦或代价]`。

## 4. Differentiation And Alternatives

| Alternative | Why users choose it today | Our verified mechanism | Result difference | Fit boundary | Evidence / reviewed_at |
| --- | --- | --- | --- | --- | --- |

- 最重要的独特机制：
- 适合我们的条件：
- 不适合我们的条件：
- 不得使用的竞争声明：

## 5. Evidence Inventory

| Evidence family | Available asset / fact | Permission to publish | Required qualification | Selected page use |
| --- | --- | --- | --- | --- |
| Product demo |  |  |  |  |
| Customer logos |  |  |  |  |
| Quantitative metrics |  |  |  |  |
| Case studies |  |  |  |  |
| Testimonials |  |  |  |  |
| Integrations |  |  |  |  |
| Pricing / trial / cancellation |  |  |  |  |
| Security / privacy / compliance / SLA |  |  |  |  |
| Awards / rankings / comparisons |  |  |  |  |

没有真实资产时的处理：<omit module / use verified mechanism / request asset；禁止生成假证据>

## 6. Claim Ledger

Status 只能使用 `Verified`、`Qualified`、`Planned` 或 `Unsupported`。

| Claim ID | Draft claim | Source | Status | Allowed public wording | Required qualification | Owner / reviewed_at | Page locations |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CLM-001 |  |  |  |  |  |  |  |

发布前确认：

- [ ] 每个数字、客户数、节省时间、ROI、排名和奖项都有口径与当前来源。
- [ ] 每个 Logo、评价、头像、姓名、职位和公司都有公开或书面授权。
- [ ] 集成状态标明 native / Beta / third-party / manual 等真实边界。
- [ ] Pricing、币种、周期、席位、用量、超额、税费、试用、退款与取消政策一致。
- [ ] 安全、隐私、合规、SLA 和保证性措辞与正式文件一致。
- [ ] PRD 中 Planned 能力没有写成当前能力。
- [ ] `Qualified` 的限定语仍在；`Unsupported` 没有进入发布内容。
- [ ] 发布代码、CMS、metadata、schema 和图片中没有 `[EVIDENCE REQUIRED: ...]`。

## 7. Objection Map

| Priority | Objection | Evidence-backed answer | Page module | Remaining risk |
| --- | --- | --- | --- | --- |
| 1 | Relevance：适不适合我？ |  |  |  |
| 2 | Efficacy：真的有效吗？ |  |  |  |
| 3 | Effort：上线、迁移和学习成本？ |  |  |  |
| 4 | Risk：安全、可靠性、锁定和失败代价？ |  |  |  |
| 5 | Cost：总成本和回报？ |  |  |  |
| 6 | Timing / Authority：为何现在、谁要参与？ |  |  |  |

## 8. Structure And Module Plan

- Structure path: <registered_template / custom / brief_only / not_applicable>
- Selected template: <only for registered_template; otherwise N/A>
- Why this path matches the task, awareness / Offer / proof:
- Existing page structure to preserve:
- Reference is: <structure-only / visual target / both>
- Required modules:
- Conditional modules with evidence:
- Omitted modules and reason:
- Added project-specific modules and reason:
- Recommended order:
- Mobile order differences:

| Module | Buying belief / purpose | Required input | Claim IDs | Asset | CTA / interaction | Keep / change / omit |
| --- | --- | --- | --- | --- | --- | --- |

## 9. Messaging And Copy Specification

### Voice

- Brand voice:
- Audience vocabulary:
- Reading level / locale considerations:
- Required legal or policy wording:
- Banned words / claims:

### Hero

- Eyebrow / micro-proof:
- H1 primary:
- H1 alternative A（仅有策略差异时）:
- H1 alternative B（仅有策略差异时）:
- Subhead:
- Primary CTA:
- CTA next-step microcopy:
- Secondary CTA:
- Hero visual content and evidence:

### Page narrative

| Module | Headline | Core copy | Mechanism | Evidence / Claim IDs | Objection answered | Next belief |
| --- | --- | --- | --- | --- | --- | --- |

### Marketing expert review

- Evidence packet provided:
- Reviewer / role:
- Main recommendation:
- Alternatives and strategic difference:
- Unsupported or risky suggestions removed:
- Final fact-check owner:

## 10. CTA, Pricing And Form Contract

- Primary CTA labels across page（语义一致）：
- CTA destination and tracking:
- Form fields and why each is needed:
- Validation / error / success behavior:
- Response time or follow-up promise and evidence:
- Pricing display / currency / billing period:
- Seats, limits, overage, tax, contract, trial, refund, cancellation:
- “Recommended / Most popular” evidence or replacement wording:
- No fake urgency confirmation:

## 11. Design, Assets And Protected Boundaries

- Existing `DESIGN.md` / brand / component sources:
- Real product media plan:
- Customer / partner asset permissions:
- Missing assets requiring approved creation:
- Desktop / mobile / long-copy behavior:
- Accessibility requirements:
- Performance budget or important media constraints:
- What to keep:
- What to change:
- What not to change（business logic / API / CTA target / analytics / SEO route / legal text）:
- Rollback plan（refactor lane）:

## 12. Discoverability And Measurement

- Search intent / primary queries（如适用）:
- Title / description / canonical:
- Open Graph / share image:
- Structured data and visible-content source:
- Crawl / sitemap / locale alternates:
- Landing Page view event:
- Primary CTA event:
- Form start / success / error events:
- Secondary CTA event:
- Experiment id / variant（仅真实实验）:
- Privacy / consent constraints:
- Baseline and post-launch observation window:

## 13. Optional Quality Review

此表是可选的自评提示，不是 devrules 的通用发布分数门槛。项目可以使用自己的量表、
阈值或标记本节 `N/A`。若使用本表，每项 `0`（未满足）、`1`（部分满足）、`2`
（明确满足），总分 16；分数不能覆盖下方 Claim Ledger 的真实性门禁。

| Dimension | 2 分标准 | Score | Evidence / action |
| --- | --- | --- | --- |
| ICP 聚焦 | 首屏即可判断为谁服务及触发场景。 |  |  |
| 结果清晰 | 每个主要区块表达客户能获得的结果。 |  |  |
| 差异化机制 | 解释为何能做到，而非只列功能。 |  |  |
| 证据完整性 | 每项事实进入 Ledger 且可追溯。 |  |  |
| 异议覆盖 | 主要购买风险被直接回答。 |  |  |
| CTA 一致性 | 主行动或有意分流的优先级清楚，下一步真实。 |  |  |
| 具体与可扫读 | 标题具体、段落短、无空泛套话。 |  |  |
| 诚实边界 | 限定、Beta、适用范围和成本透明。 |  |  |

- Total:
- Evidence completeness score:
- Project threshold / N/A:
- Verdict: <ready / revise / blocked / N/A>

## 14. Final Verification

- [ ] 每个主要区块推动一个客户结果、购买信念或必要风险判断，否则已删除。
- [ ] 每个事实性声明都有证据，否则已删除、限定或阻止发布。
- [ ] Primary CTA、链接、表单、导航、FAQ、媒体和错误状态真实可用。
- [ ] 桌面、移动端、长文本、键盘、focus-visible、对比度和触控目标已验证。
- [ ] metadata、canonical、可抓取正文、结构化数据和分析事件已验证。
- [ ] 项目原生 formatter/lint/typecheck/tests/build 与适用 design checks 已通过。
- [ ] 有视觉来源时已用相同 viewport 并排比较并复核修正结果。
- [ ] 无占位文案、占位图、假 Logo、假评价、假数字、假公司或失效 URL。

Last updated: 2026-07-17
