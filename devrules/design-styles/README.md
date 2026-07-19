---
description: Contract and lifecycle for the shared named design style library.
ownership: shared
governs: product
activation: conditional
enforcement: advisory
decision_owner: devrules
side_effects: none
---

# Named Design Style Library

`design-styles/` is the shared, template-owned catalog of portable UI design
languages. A style pack captures reusable visual decisions and their evidence;
it must not contain product copy, routes, business logic, customer data, or a
source repository's private configuration.

## Style pack contract

Each published directory is named by a stable kebab-case id and contains:

- `style.json`: identity, version, suitability, sources, and exclusions.
- `DESIGN.md`: lintable tokens, design rationale, component rules, and prohibitions.
- `evidence.json`: source commits, inspected files, shared signals, divergences,
  and editorial decisions. Frequency is evidence, not a design decision.
- `application.md`: fit check, adoption boundary, stack-neutral mapping, and QA.

`catalog.json` is the machine-readable index. Published packs are universal
template assets and travel with devrules template synchronization.

## Lifecycle

```bash
# 1. Read-only evidence preview; repeat --source and --exclude as needed.
node devrules/scripts/design-style-library.mjs extract \
  --source ../source-a --source ../source-b \
  --exclude src/pages/admin --id proposed-style --json

# 2. Write a review workspace only after checking the preview.
node devrules/scripts/design-style-library.mjs extract \
  --source ../source-a --source ../source-b \
  --exclude src/pages/admin --id proposed-style \
  --out /tmp/proposed-style --apply

# 3. An agent reviews the evidence and authors the complete pack, then validates it.
node devrules/scripts/design-style-library.mjs validate --style /tmp/proposed-style
node devrules/scripts/design-lint.mjs --design /tmp/proposed-style/DESIGN.md --offline

# 4. Dry-run, then publish. Existing ids are never overwritten by this command.
node devrules/scripts/design-style-library.mjs publish --source /tmp/proposed-style
node devrules/scripts/design-style-library.mjs publish --source /tmp/proposed-style --apply

# 5. Discover and apply by stable name. Existing differing target files cause a conflict.
node devrules/scripts/design-style-library.mjs list
node devrules/scripts/design-style-library.mjs apply --style proposed-style --repo ../target
node devrules/scripts/design-style-library.mjs apply --style proposed-style --repo ../target --apply
```

Follow `workflows/design-extract-style.md` for extraction and publication, and
`workflows/design-apply-style.md` for application. Applying creates an editable
project fork: later project-specific changes belong in the target `DESIGN.md`
and follow `design-change.md`; they do not silently mutate the shared pack.
