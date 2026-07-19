---
description: CLI usage for validating and aggregating non-secret developer-service account records and project bindings.
ownership: shared
governs: agent
activation: conditional
enforcement: advisory
decision_owner: project
side_effects: none
---

# Developer Services Registry CLI

`developer-services-registry.mjs` validates and aggregates non-secret developer-service account records and project bindings without contacting providers.

## Commands

```bash
# Create a project-local JSON inventory; dry-run unless --apply is present.
devrules services init --project <project>
devrules services init --project <project> --apply

# Validate every discovered project and global account record.
devrules services validate --root <workspace>

# Query by project, provider, or account.
devrules services inspect --root <workspace> --project <project-id>
devrules services inspect --root <workspace> --provider supabase
devrules services inspect --root <workspace> --account cloudflare:owner-free-01

# Preview or write the generated JSON and Markdown catalog.
devrules services catalog --root <workspace>
devrules services catalog --root <workspace> --apply
```

The default account-record directory is
`<workspace>/devrules/registry/developer-account-records/` when the supplied
workspace root contains the shared template; otherwise it falls back to the
registry under the canonical template selected by the device-local runtime
locator. The workspace does not need its own `devrules` directory. Override the
account source in isolated tests or non-standard installations with
`--accounts <dir>`.

Workspace discovery checks the supplied root and its immediate child projects.
Use `--recursive` for nested project layouts. Generated catalogs go to
`<workspace>/devrules/reports/developer-services/` by default and must not be
hand-edited.

## Multiple bindings

Two Supabase bindings in the same environment are valid when their target
identities are distinct. If they are selectable alternatives, both records use
the same `selection.group` and different selector values. The validator also
requires data authority and warns about missing selection/switch information.

Use `templates/ops/examples/developer-services-multi-supabase.json` as the
reference for A/B database profiles such as DeGit's
`ACTIVE_SUPABASE_PROFILE=A|B` model.

## Exit behavior

- Validation errors return a non-zero exit code.
- Warnings remain non-blocking unless `--strict` is supplied.
- `catalog --apply` refuses to write while validation errors exist.
- `init` never overwrites an existing project inventory.
- Writes are atomic; catalog generation uses a local lock.
