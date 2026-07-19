---
description: Python code-health adapter.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Python

- Use the repository's Ruff/Black/isort configuration; do not combine formatters
  with conflicting ownership.
- Keep module import side effects minimal and avoid mutable module-level state.
- Use explicit types and narrow protocols at shared boundaries when the project
  has type checking.
- Do not use broad `except Exception` to hide an unknown defect. Catch at the
  boundary that can add context or make a real recovery decision.
- Avoid catch-all `utils.py` and `helpers.py`; name modules after capabilities.
- Keep I/O, framework integration, and provider clients outside pure domain
  transformations where the project shape supports it.
- Run the configured formatter/linter, type checker, focused tests, and package
  or application build/check lane.
