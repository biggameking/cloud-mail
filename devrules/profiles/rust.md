---
description: Rust code-health adapter.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Rust

- Use `rustfmt` and repository Clippy configuration as the mechanical source of
  truth.
- Model invalid states out of types where practical; do not replace domain
  validation with unchecked `unwrap`, `expect`, or broad error erasure.
- Keep crates and modules cohesive. Use `pub(crate)` or private visibility by
  default and expose the smallest stable API.
- Keep platform, persistence, command/transport, and provider details outside
  core domain modules.
- Preserve error sources and context at boundaries. Panics are for violated
  invariants, not normal runtime failure.
- Run `cargo fmt --check`, scoped Clippy, tests, and the relevant build target.
