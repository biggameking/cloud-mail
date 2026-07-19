---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

<!-- ============================================================================
Design Refactor State —— UI 重构阶段状态机。
建议保存为 docs/ui-refactor/design-refactor-state.json，并用
node devrules/scripts/design-refactor-state.mjs --state docs/ui-refactor/design-refactor-state.json 校验。
============================================================================ -->

# Design Refactor State

```json
{
  "project_name": "<project>",
  "mode": "hybrid",
  "current_phase": "phase_00",
  "completed_phases": [],
  "blocked": false,
  "blockers": [],
  "risks": [],
  "last_validation": "",
  "protected_paths": [
    "api/",
    "server/",
    "database/",
    "auth/",
    "payments/",
    "analytics/"
  ],
  "artifacts": {
    "phase_00": [
      "docs/ui-refactor/repository-intake.md",
      "docs/ui-refactor/screen-inventory.md",
      "docs/ui-refactor/component-inventory.md"
    ],
    "phase_01": [
      "docs/ui-refactor/design-debt-report.md"
    ],
    "phase_02": [
      "DESIGN.md"
    ],
    "phase_03": [
      "docs/ui-refactor/component-inventory.md",
      "docs/ui-refactor/base-component-plan.md"
    ],
    "phase_04": [
      "docs/ui-refactor/screen-specs"
    ],
    "phase_05": [
      "docs/ui-refactor/secondary-screen-standardization.md"
    ],
    "phase_06": [
      "docs/ui-refactor/state-coverage-report.md"
    ],
    "phase_07": [
      "docs/ui-refactor/qa-report.md"
    ],
    "phase_08": [
      "docs/ui-refactor/final-ui-refactor-report.md",
      "docs/ui-refactor/handoff-notes.md"
    ]
  }
}
```

## Modes
- `incremental`：保留 IA 和主流程，渐进统一。
- `hybrid`：核心流程可重排，次级页标准化。默认。
- `full_redesign`：产品架构门禁通过后重建 IA/导航/页面，仍保护业务边界。
