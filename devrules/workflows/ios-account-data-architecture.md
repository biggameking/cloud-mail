---
description: Conditional workflow for project-owned iOS account, persistence, sync, identity, and migration decisions.
ownership: shared
governs: product
activation: conditional
enforcement: gate
decision_owner: project
side_effects: none
---

# iOS Account And Data Architecture

Use this workflow when an iOS/iPadOS task creates or materially changes local
persistence, iCloud/CloudKit, authentication, ownership, collaboration, sync,
recovery, deletion, or a server-owned user-data boundary. Read
`rules/ios-account-data-model.md` first and reuse a current project decision
when it already covers the change.

The project or user selects the product architecture. This workflow structures
the decision and its safety evidence; it does not supply a default lane.

## Goal, Constraints, And Done Criteria

- **Goal:** make the ownership, identity, authority, lifecycle, and migration
  semantics needed by the proposed change explicit before implementation.
- **Constraints:** preserve existing data and privacy; do not infer ownership
  from an SDK, provider, or mockup; do not invent a regional exemption.
- **Done:** the affected decisions and applicable safety gates are resolved in
  an existing project artifact or a focused decision record. Conditional or
  irrelevant fields may be `N/A` with a reason.

## When The Workflow Is Not Required

- Purely visual, copy-only, test-only, or mechanical changes that do not affect
  an account/data boundary proceed without creating this artifact.
- A current project decision covers the affected boundary and the change does
  not invalidate its assumptions.
- The product is not an iOS/iPadOS app; use its applicable platform workflow.

Do not postpone an unrelated task merely because the repository has no iOS
account/data decision file.

## 1. Establish Applicability And Decision Owner

Name the exact boundary being created or changed and the project/user decision
owner. Examples include the first persistent schema, adding sync, changing the
logical owner, adopting authentication, account linking, deletion, or migrating
released data.

If no such boundary is affected, record `not_required` only when the surrounding
workflow needs an applicability result; otherwise continue without ceremony.

## 2. Collect Product And System Evidence

Record what is relevant:

- offline and login-free requirements;
- device-only, Apple-ecosystem, cross-platform, collaboration, server-
  authorization, and recovery needs;
- existing architecture, providers, schemas, persisted data, users, and
  released client versions;
- data sensitivity, access control, retention, export, deletion, backup, and
  restore requirements;
- intended release regions and selected network/hosting resources.

Separate approved product requirements from implementation convenience.

## 3. Compare Viable Topologies

Compare only plausible candidates for this product. Typical candidates include
device-local, local with platform sync, account-backed, workspace-backed, and
hybrid per-data-category authority. Other project-specific topologies are valid.

For each viable candidate, state:

- logical owner and source of truth;
- offline and cross-device/cross-platform behavior;
- identity transitions and recovery behavior;
- privacy, operational, migration, and lock-in risks;
- why it does or does not satisfy the approved requirements.

Record the selected topology and decision owner. There is no devrules-preferred
lane and no requirement to reject a fixed number of alternatives.

## 4. Define Identity And Keys

Map the persistent entities and principals affected by the change. Candidate
key strategies may include application-generated IDs, an internal account ID
such as `user_id`, server-assigned resource IDs, or deliberately adopted
provider subjects.

For the chosen strategy, demonstrate the applicable behavior across login,
logout, email change, provider linking/loss, account merge, system-account
switch, reinstall, restore, and service migration. External identifiers may be
used when the project chooses them deliberately and their lifecycle matches the
data contract; they must not silently re-key, orphan, disclose, or delete data.

## 5. Define Authority, Privacy, And Lifecycle

For each affected data category, record its authority and the applicable
behavior for creation, offline writes, first sync, retry, conflict, duplicate
prevention, deletion, export, retention, backup, restore, reinstall, and device
replacement. Specify access control and user-visible account/sync state where
needed.

Use `templates/sync/local-first-sync.md`, `backup-maintenance.md`, or another
project/provider-specific reference only when that topology is selected.

## 6. Plan Existing-Data And Released-Client Safety

When the change affects released persistent data, deployed clients, or public
contracts, define:

- forward and backward compatibility, including mixed versions;
- idempotent migration and partial-failure handling;
- backup or recovery points, rollback limits, and restore verification;
- observability and an accountable rollout owner.

These are hard gates. Apply `production-change.md` and
`workflows/production-change.md` when their boundary is reached. A missing
ceremonial document is not the risk; an unsafe or unverified migration is.

## 7. Evaluate Regional Gates Conditionally

If mainland China is an intended release region, or the chosen resources make
its policy boundary applicable, review APP filing, ICP/licensing, resource, and
category-specific obligations separately using current official evidence and
`workflows/apple-app-store-launch.md`. Do not infer exemption from local-only,
iCloud, CloudKit, third-party hosting, or the absence of a custom backend.

Otherwise mark the mainland-China section `N/A` with the project reason. It is
then resolved and does not block implementation.

## 8. Gate Only The Affected Implementation

Proceed when the decisions needed by this change are explicit and the
applicable data-integrity, privacy, access-control, migration, rollback, and
recovery risks have credible handling and verification.

Block only the affected persistence/auth/sync implementation when a material
decision or safety property remains unresolved. Do not block pure UI or other
unrelated work because the broader artifact is incomplete.

Handoff the selected topology, decision owner, affected entities, unresolved
risks, migration needs, and verification plan. Use
`templates/ios-account-data-decision.md` only if the repository lacks a more
suitable decision format.
