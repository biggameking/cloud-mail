---
description: Go code-health adapter.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Go

- Run `gofmt` or `goimports`; mechanical formatting is not a review debate.
- Use short, non-redundant package names and avoid `util`, `common`, `misc`,
  `api`, `types`, or `interfaces` dumping grounds.
- Define interfaces at the consumer boundary when abstraction is actually
  needed. Do not create an interface for every concrete type.
- Keep error flow explicit, add context without duplicating it, and do not panic
  for ordinary failures.
- Make goroutine ownership, lifetime, cancellation, and shutdown visible.
- Prefer small packages with cohesive APIs, but avoid package sprawl created
  only to satisfy file-size targets.
- Run formatting, `go vet`, focused `go test`, race checks when concurrency is
  affected, and the relevant build.
