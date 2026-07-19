---
title: Contract Governance
description: Pattern for API, route, event, schema, import/export, native bridge, and manifest contracts.
ownership: seed
governs: agent
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - APIs
  - sync protocols
  - native bridges
  - event telemetry
  - import/export formats
  - monorepo manifests
use_when:
  - Multiple modules, platforms, agents, or external clients depend on stable contracts.
do_not_use_when:
  - A module is internal and has no downstream consumer.
outputs:
  - contract inventory
  - compatibility policy
  - verification plan
  - change checklist
case_sources:
  - planner-v0 route and app manifests
  - SetMail local API and SDK
  - DeGit CLI command manifest
  - structureUI domain tests
  - FrameCast project command tests
related_workflows:
  - devrules/workflows/devrules-audit.md
last_reviewed: 2026-06-11
---

# Contract Governance

Contracts are promises between parts of the system. They deserve names, tests, and change policy.

## Contract Types

- API request/response
- server action input/output
- native bridge command
- event payload
- telemetry event
- import/export package
- sync protocol
- route manifest
- feature manifest
- database migration boundary

## Contract Inventory

For each contract record:

- owner
- consumers
- version or compatibility rule
- validation method
- test command
- deprecation process

Recommended inventory shape:

| Contract | Owner | Consumers | Compatibility rule | Verification |
| --- | --- | --- | --- | --- |
| route or command name | module/lane | modules, apps, users, external clients | additive, versioned, or breaking | test/build/audit command |

Keep the inventory near the boundary: module README, package README, API docs, or `devrules/memory/project-profile.md` for repository-wide contracts.

## Change Policy

- Add fields compatibly where possible.
- Version when semantics change.
- Deprecate before removing.
- Update manifests and generated clients together.
- Keep fixtures for important external formats.

## Review Checklist

- Contracts have tests.
- Consumers are known.
- Breaking changes are explicit.
- Generated artifacts are refreshed.
- Documentation and manifests match code.
- README anchors mention public contracts and downstream consumers.
