---
title: Modular Boundaries
description: Pattern for separating UI, domain, data access, adapters, side effects, configuration, and platform integration.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - modular apps
  - refactors
  - service layers
  - admin consoles
  - desktop/web hybrids
use_when:
  - A feature risks mixing UI, business logic, data access, providers, and side effects.
do_not_use_when:
  - The existing project has a small simple structure and no boundary pressure.
outputs:
  - responsibility map
  - boundary rules
  - dependency direction
  - review checklist
case_sources:
  - SetMail architecture
  - structureUI packages/domain
  - DeGit services and pages
  - NovelEditor modules
  - OpsHub apps/packages
related_workflows:
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-06-11
---

# Modular Boundaries

Good boundaries make code easier to find and safer to change.

## Responsibility Layers

- UI rendering
- UI state/orchestration
- domain logic
- data access
- provider adapters
- platform/native integration
- configuration
- observability
- scripts/automation

## Module Shape Pattern

Feature modules work best when their public shape is explicit:

```text
feature-or-module/
|-- README.md
|-- index.ts
|-- config.ts
|-- pages/
|-- components/
|-- hooks/
|-- services/
|-- utils/
|-- types/
```

Adapt names to the project. The important part is the boundary:

- `index` exports the public module surface or registration object.
- `config` owns module metadata, routes, capabilities, or feature flags.
- `services` own business/data operations for this module only.
- shared services live outside the module when reused by multiple modules.
- UI components should not own provider SDKs, database clients, or privileged side effects.

For non-frontend projects, map the same pattern to command handlers, domain modules, adapters, and tests.

## Dependency Direction

Prefer:

- UI depends on domain/service interfaces.
- Domain does not depend on UI.
- Provider adapters depend on provider SDKs.
- Feature services depend on adapter interfaces.
- Scripts call public service boundaries where possible.

## Boundary Smells

- UI imports provider SDKs directly.
- Data access is copied into many components.
- Permission logic exists only in UI.
- Native commands contain presentation decisions.
- Global config is read from deep inside unrelated functions.
- Feature modules mutate shared registries without a documented registration path.
- Shared service behavior is duplicated inside many feature modules.
- Platform-specific code leaks into shared domain logic.

## Review Checklist

- Each module has one clear responsibility.
- Side effects are behind explicit boundaries.
- Shared logic is not duplicated across platform lanes.
- New abstractions reduce real complexity.
- File locations help agents find the right code quickly.
