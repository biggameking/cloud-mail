---
description: Universal code quality rules for readable, explicit, locally consistent implementation.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Code Quality

Apply this rule whenever production code, tests, scripts, configuration code,
or generated-code inputs are created or changed.

## Priority

1. Correct behavior and explicit contracts.
2. Repository-local conventions and the language's canonical formatter.
3. Simplicity, local reasoning, and maintainability.
4. This universal guidance when the repository has no stronger convention.

Do not impose one indentation width, brace style, or line width across every
language. Use the repository formatter as the mechanical source of truth.

## Formatting And Files

- Use LF line endings unless a checked-in project rule requires otherwise.
- End text files with one newline and do not add trailing whitespace.
- Let formatters own indentation, wrapping, spacing, and import ordering.
- Format changed files or changed regions only. Avoid drive-by formatting churn.
- Do not edit generated, vendored, lock, migration-history, or snapshot files
  unless the task or their generator explicitly requires it.

## Naming

- Name modules and types with domain concepts, not implementation accidents.
- Name functions with verbs that describe their observable action.
- When consistent with the language and repository, name booleans with forms
  such as `is`, `has`, `can`, `should`, or `needs` that make their truth meaning
  clear.
- Keep short local names when their scope makes the meaning obvious; use
  descriptive names for public, shared, long-lived, or distant state.
- Avoid generic dumping grounds such as `utils`, `common`, `misc`, `helpers`,
  and catch-all `Manager` types. Use a narrow capability or domain name.
- Do not encode type information in names when the language already expresses it.

## Comments And Documentation

- Make the code explain how. Use comments for intent, constraints, invariants,
  tradeoffs, compatibility, non-obvious failure behavior, and why a simpler
  looking alternative is unsafe.
- Document public contracts and surprising edge cases without restating names
  or signatures.
- Delete commented-out code. Version control already preserves history.
- Update or remove stale comments in the same change that invalidates them.
- If a function needs headings that narrate several internal phases, first ask
  whether those phases are separate responsibilities with useful names.

## Control Flow And State

- Keep the happy path visible. Prefer guard clauses when they reduce nesting.
- Treat nesting deeper than three levels as a design signal, not as a formatting
  problem. Reshape data, extract a responsibility, or simplify the state model.
- Prefer a representation that makes a special case become the normal case.
- Keep inputs, outputs, ownership, and side effects explicit. Avoid hidden
  mutable global state and temporal coupling.
- Do not compress several operations into clever expressions. Optimize for the
  next reader, debugger, and change.

## Errors And Recovery

- Preserve useful error context and make failure visible at the owning boundary.
- Do not swallow errors, return fake success, or substitute empty/default data
  merely to keep a path running.
- Add retries only for evidence-backed transient failures. Bound attempts,
  backoff, observability, and cancellation.
- A fallback is product or operational behavior, not a substitute for an
  unexplained broken primary path.

## Size And Complexity Review Signals

Size signals trigger judgment; they are not universal limits and do not justify
mechanical file splitting.

- Around 50 logical lines in a function or cognitive complexity above 15 can
  prompt a review for mixed responsibilities, excessive state, or special
  cases.
- Around 500 handwritten lines in a source file can prompt a boundary review.
- Around 800 handwritten lines is a stronger review signal before adding more
  behavior, but a cohesive file may remain or grow when splitting would make
  ownership, generated structure, or local reasoning worse.
- Generated code, schemas, protocol tables, migrations, fixtures, snapshots,
  language conventions, and cohesive registries commonly need different
  thresholds.

Repository configuration and local conventions own the actual thresholds,
exclusions, and enforcement mode. When no project values exist, the numbers
above are advisory prompts only. Existing debt follows the ratchet in
`change-health.md`: touched legacy code may stay imperfect, while the change
should avoid materially worsening the relevant risk without justification.

## Verification

Run the closest formatter check, lint, typecheck, test, build, or static
analysis appropriate to the changed boundary. When available, run:

```bash
node devrules/scripts/code-health.mjs audit --repo <repo>
```

Report checks that could not run and the residual risk. Do not claim quality
from inspection alone when a repeatable check exists.
