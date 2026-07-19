---
description: Conditional language-specific guidance that defers to repository tooling and conventions.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Code Language Profiles

Profiles translate universal code-health rules into language-native practice.
Read only profiles matching the repository or files being changed.

## Precedence

1. Repository-local instructions and checked-in tool configuration.
2. Canonical language formatter and compiler/toolchain behavior.
3. Matching profile in this directory.
4. Universal rules under `devrules/rules/`.

Profiles must not install dependencies or replace project tooling without user
authorization. Prefer existing commands and record missing verification rather
than inventing a second toolchain.

| Evidence | Profile |
| --- | --- |
| `package.json`, TypeScript/JavaScript source | `typescript-javascript.md` |
| `Cargo.toml`, Rust source, Tauri Rust lane | `rust.md` |
| `pyproject.toml`, requirements files, Python source | `python.md` |
| `go.mod`, Go source | `go.md` |
| `Package.swift`, `.xcodeproj`, Swift source | `swift.md` |

Mixed repositories use every matching profile, but each check should be scoped
to the lane that changed.
