---
title: Local-First Sync
description: Pattern for local-first data, cloud sync, LAN sync, per-device settings, authority, and optional sync categories.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - desktop apps
  - iOS and iPadOS apps
  - offline-capable apps
  - multi-device products
  - local workspace tools
use_when:
  - A product keeps local state and syncs selected data to cloud or peer devices.
do_not_use_when:
  - All state is server-only and online-only.
outputs:
  - authority map
  - sync category map
  - per-device setting policy
  - membership/entitlement notes
  - verification checklist
case_sources:
  - DeGit settings and sync scheme
  - planner-v0 data gateway sync-v2
  - structureUI offline workspace cache
  - SetMail local-first architecture
related_workflows:
  - devrules/workflows/backup-maintenance.md
  - devrules/workflows/ios-account-data-architecture.md
last_reviewed: 2026-07-15
---

# Local-First Sync

Local-first sync needs explicit authority. Otherwise every device believes it owns the truth.

## Authority Map

Define for each data category:

- local-only
- remote-authoritative
- local-authoritative
- merged
- derived/cache
- per-device

Examples:

- theme may be unified
- launch-at-login is per-device
- local filesystem path is per-device
- shared project metadata may be remote-authoritative
- local AI keys should remain local-only

## Optional Vs Auto-Included Sync

Separate:

- optional categories users can disable
- auto-included categories required for sync correctness
- excluded categories that must never sync

Do not let UI toggles overlap hidden auto-included categories without documentation.

## Cloud And LAN Split

Cloud sync often provides account-backed persistence and cross-network devices.

LAN sync can provide same-network convenience without cloud membership.

Define:

- which data each mode can sync
- entitlement requirements
- privacy differences
- conflict behavior
- status UI

## Apple Local-First And iCloud Contract

For a new or materially changed iOS/iPadOS persistence boundary, first run
`devrules/workflows/ios-account-data-architecture.md` and record the selected
identity lane. Unless an approved product requirement needs app-account-backed
ownership, use the `local_first` lane with either `local_only` or `icloud` sync.

In the default iCloud lane:

- The local persisted store is the primary usable copy. The core product keeps
  working while offline or when iCloud is unavailable.
- Application-generated immutable IDs identify domain entities. Apple ID,
  CloudKit current-user identity, record names, device IDs, email, and optional
  login subjects do not become domain primary keys.
- CloudKit identifiers remain transport/adapter metadata. Define the mapping to
  domain IDs instead of leaking CloudKit record identity through the model.
- Define first-sync merge, duplicate prevention, conflict rules, iCloud being
  disabled, system Apple-account switching, reinstall, device replacement,
  deletion, export, and restore before claiming sync support.
- Optional Sign in with Apple may link a bounded feature or recovery identity,
  but sign-in, sign-out, revocation, and provider switching must not silently
  re-key or delete local/iCloud content.

If the product explicitly needs cross-platform accounts, collaboration,
server-side ownership, or account-level recovery, switch only through the
approved `account_backed` lane and keep an application-generated internal
`user_id` behind provider mappings.

## Review Checklist

- Every data category has an authority.
- Per-device settings do not overwrite local state from another device.
- Optional sync toggles match backend behavior.
- Sensitive local data is excluded by default.
- Sync status is visible to users.
- iOS/iPadOS work has a current account/data decision before persistence or auth
  implementation begins.
