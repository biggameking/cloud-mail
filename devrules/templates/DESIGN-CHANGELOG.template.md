---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

# DESIGN-CHANGELOG

<!-- 复制本文件到项目根命名为 DESIGN-CHANGELOG.md。
     每次 DESIGN.md 变更追加一条（最新在最上）。这是设计决策的审计线：
     半年后回看「为什么按钮是 10px 圆角」，答案应该在这里。 -->

## [YYYY-MM-DD] <一句话标题>

- **类型**：token-change | component-added | component-changed | rule-change | adopt/init
- **动机**：<为什么改：用户反馈 / 可读性问题 / 品牌调整 / 新场景…（一两句）>
- **变更**：<改了哪些 token / 组件 / 规则。粘贴 `designmd diff` 的关键输出（added/removed/modified）>
- **影响面**：<受影响的组件与页面；`design-guard` / grep 排查结果；是否需要视觉回归确认>
- **迁移**：<代码侧需要做什么（通常是"无 —— design:sync 后自动生效"；组件结构变化时写明步骤）>

---

## [2026-07-04] 初始化设计系统（示例条目，替换我）

- **类型**：adopt/init
- **动机**：接入 devrules，把设计规范沉淀为 DESIGN.md 单一事实源。
- **变更**：建立全量 tokens（colors / typography / rounded / spacing / motion / elevation）与
  10 个核心组件规格；接入 design-sync / design-guard / design-lint 与 pre-commit、CI 门禁。
- **影响面**：全部 UI 代码改为消费语义 token 类；存量硬编码见 design-guard.allow.json 的迁移期豁免。
- **迁移**：新代码一律走 DESIGN.md 派生 token；豁免清单按 design-audit.md 每次审计递减。
