---
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
---

# iOS account and data decision: <app/change>

Use this optional template with
`devrules/workflows/ios-account-data-architecture.md` when the project does not
already have an architecture-decision format. Keep only applicable sections.
An explicit `N/A` with a reason is a valid resolved result.

## 1. Applicability and ownership

- Boundary being created or changed:
- Decision owner: <project role / user>
- Review date:
- Product/release baseline:
- Artifact status: <approved / blocked / superseded>
- Related product/architecture decisions:
- Unaffected work that may proceed independently:

## 2. Product and system evidence

- Offline and login-free requirements:
- Device-only or cross-device requirements:
- Apple-only or cross-platform requirements:
- Collaboration, server authorization, or recovery requirements:
- Existing users, data, providers, schemas, and released clients:
- Data sensitivity, retention, export, deletion, backup, and restore needs:
- Intended release regions:

## 3. Candidate topologies and decision

Candidates can include device-local, local with platform sync, account-backed,
workspace-backed, hybrid, or another project-specific topology. None is the
devrules default.

| Candidate | Meets requirements | Ownership/authority | Offline/sync behavior | Privacy/operational/migration risks | Decision rationale |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

- Selected topology:
- Selecting decision owner and evidence:
- Assumptions that would require re-review:

## 4. Identity and key map

An internal `user_id` is one candidate strategy, not a required name or design.
Document the key actually selected and why its lifecycle fits.

| Concept or entity | Logical owner | Selected stable key | External/transport keys | Authority | Identity-transition behavior |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

- Key stability and collision strategy:
- Mutable alias policy, if applicable:
- Provider linking, loss, merge, or recovery behavior, if applicable:
- Proof that identity transitions do not silently re-key, orphan, expose, or
  delete data:

## 5. Data authority, privacy, and lifecycle

| Data category | Authority | Storage/sync scope | Access control | Offline/conflict behavior | Delete/export/restore behavior |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

- First-sync, retry, and duplicate-prevention strategy:
- Sign-out, account/system-identity switch, and revocation behavior:
- Reinstall and device-replacement behavior:
- User-visible account/sync status:
- Privacy and least-privilege evidence:

## 6. Existing-data and released-client safety

Complete when existing persistent data, deployed clients, or public contracts
are affected; otherwise state `N/A` and why.

- Compatibility and mixed-version behavior:
- Idempotent migration and partial-failure handling:
- Backup/recovery point:
- Rollback limits and procedure:
- Restore/recovery verification:
- Rollout observability and owner:

## 7. Regional compliance

- Is mainland China an intended release region or otherwise applicable to the
  selected resources? <yes / no / unresolved>
- If no, `N/A` reason:
- If yes or unresolved, current APP filing evidence and date:
- Website ICP/licensing evidence and date, if applicable:
- Domain/IP/hosting/access-resource evidence and date, if applicable:
- Category-specific obligations, if applicable:
- Compliance decision owner and unresolved blockers:

Do not infer an exemption from local-only storage, iCloud/CloudKit, third-party
resources, or the absence of a custom backend.

## 8. Affected implementation gate

Mark only applicable items `complete`, `blocked`, or `N/A` with a reason.

- [ ] Ownership, authority, identity, and key decisions needed by this change
      are explicit.
- [ ] Applicable privacy and access-control behavior is defined.
- [ ] Applicable offline, conflict, identity-transition, deletion, export,
      backup, restore, and recovery behavior is defined.
- [ ] Existing-data and released-client migration has compatibility, rollback,
      and recovery evidence, or is `N/A` with a reason.
- [ ] Regional compliance is resolved for intended release regions, or is
      `N/A` with a reason.

- Gate result for the affected implementation: <ready / blocked>
- Blocking risks or decisions:
- Independent work allowed to proceed:
- Verification plan:
