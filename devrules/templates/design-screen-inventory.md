---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
Screen Inventory —— 存量 UI intake / 产品架构门禁通过后的 surface-to-screen
盘点 / full redesign 页面清单。输出建议：docs/ui-refactor/screen-inventory.md。

产品能力、流程、导航和 surface 所有权来自产品/IA 基线；本表只盘点这些事实如何
落到当前 screen、route 或其他 UI touchpoint，不自行发明产品结构。
============================================================================ -->

# Screen Inventory：<项目 / 范围>

| Surface ID | Screen | File / Route | Product Domain | Surface Role | Capability IDs | Flow IDs | Current Purpose | Primary Task Clear? | Refactor Needed? | Priority | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|

## Coverage

- 产品/IA 基线：
- Product Architecture Brief：
- 已识别 primary destinations：
- 已识别 secondary/contextual/settings surfaces：
- 未确认 surface 或页面：
- 需要产品决策的边界与 DEC ID：

## Navigation Summary

```txt
App
└── ...
```

## Traceability Check

- [ ] 每个 screen/route 对应已批准的 `SURFACE-*`，或明确标记为待处理遗留项。
- [ ] `CAP-*` 与 `FLOW-*` 来自产品/IA 基线，没有因页面结构被重新定义。
- [ ] cross-cutting capability 没有被误升为重复的 primary destination。
- [ ] no-direct-surface capability 没有仅为“功能可见”而新增独立页面。
- [ ] 未决产品结构问题带 `DEC-*` 并回到 Product Architecture Review，不由 UI 审计静默决定。
