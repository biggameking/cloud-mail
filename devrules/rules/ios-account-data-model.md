---
description: Conditional decision gate for iOS account, ownership, persistence, sync, and data-lifecycle changes.
ownership: shared
governs: product
activation: conditional
enforcement: gate
decision_owner: project
side_effects: none
---

# iOS Account And Data Model

Apply this rule when an iOS or iPadOS task creates or materially changes a
persistent user-data boundary: local storage, iCloud/CloudKit, authentication,
account ownership, collaboration, sync, recovery, deletion, or a server-owned
data model. The project or user owns the product decision. Dev rules help make
the alternatives and risks explicit; they do not select an account model,
provider, region, or storage topology for the product.

A visual, copy-only, test-only, or mechanical change that does not touch one of
those boundaries does not require a new decision artifact and must not be
blocked because one is absent.

## Decision To Record

Use the repository's existing architecture-decision format when one exists.
Otherwise, `templates/ios-account-data-decision.md` is an optional starting
point. Record only the parts that affect the proposed change:

- the product's ownership and access requirements;
- the chosen data authority and sync topology;
- the identity and key strategy, including the behavior of mutable or
  provider-owned identifiers;
- offline, sign-out, account-switch, deletion, export, restore, and recovery
  behavior that applies;
- compatibility and migration requirements for existing data or released
  clients;
- intended distribution regions and any conditional compliance work.

A missing document is not itself a blocker. An unresolved decision blocks only
the implementation that would make that decision expensive or unsafe, such as
creating a production schema while ownership or migration semantics remain
unknown.

## Candidate Architecture Lanes

Treat these as candidates, not defaults or an exhaustive list:

- **Device-local:** data is owned and persisted on the device; cross-device
  sync is not a product requirement.
- **Local store with platform sync:** a local store remains useful offline and
  iCloud/CloudKit or another selected transport synchronizes it.
- **Account-backed:** an application or service account is the ownership root
  because product requirements need cross-platform access, collaboration,
  server authorization, account-level recovery, or similar capabilities.
- **Hybrid or workspace-backed:** different data categories have different
  authorities, or ownership belongs to a team/workspace instead of one user.

Select among these from approved product requirements and the existing system.
An authentication SDK, subscription provider, login mockup, or readily
available backend does not decide the product's ownership model by itself.

## Identity And Key Options

Choose and document keys according to the selected ownership and lifecycle
model. Possible strategies include application-generated entity IDs, a stable
internal account ID such as `user_id`, a server-assigned resource ID, or a
deliberately adopted provider subject. `user_id` is a common option, not a
required name or architecture.

For any selected strategy, assess:

- stability across login, logout, account linking, provider loss, email change,
  device replacement, restore, and service migration;
- uniqueness, collision handling, merge behavior, and idempotent retries;
- whether transport identifiers leak into domain ownership unintentionally;
- how mutable aliases such as email are updated without orphaning data;
- how external `(provider, subject)` values are linked when multiple providers
  or account recovery are supported.

The hard requirement is that released or valuable data must not be silently
re-keyed, orphaned, exposed to another principal, or destroyed by an identity
transition. The project may use any key strategy that can demonstrate those
properties.

## Data Lifecycle And Safety Gates

Before implementing an affected persistent boundary, define the applicable
behavior for:

- data authority, offline access, first sync, conflict handling, and duplicate
  prevention;
- account or system-identity changes, sign-out, revocation, and provider loss;
- deletion, export, retention, backup, restore, reinstall, and device
  replacement;
- privacy classification, access control, least-privilege storage, and user-
  visible status or failure behavior;
- migration of existing data and mixed released versions.

When released persistent data, public contracts, or deployed clients are in
scope, the migration, compatibility, backup, rollback, and recovery gates in
`production-change.md` remain mandatory. Do not replace those safety gates with
an undocumented fallback or destructive reset.

## Mainland China Conditional Gate

Run the mainland-China policy and distribution review only when the project's
intended release regions include mainland China, or when the selected hosting,
domain, IP, access, content, or service boundary otherwise makes those rules
applicable. In that case, use current official evidence and
`workflows/apple-app-store-launch.md`; architecture alone does not prove an APP
filing, ICP, licensing, or resource-compliance exemption.

When mainland China is not an intended release region and no relevant resource
boundary applies, record this section as `N/A` with the project reason. That is
a valid resolved state and must not block unrelated implementation.

Official starting points when the conditional gate applies:

- [MIIT APP filing notice](https://www.miit.gov.cn/zwgk/zcwj/wjfb/tz/art/2023/art_920db564162e4312916a01bed6540ad8.html)
- [Apple mainland China app information](https://developer.apple.com/cn/help/app-store-connect/reference/app-information/app-information)
- [Apple CloudKit](https://developer.apple.com/cn/icloud/cloudkit/)

Use `workflows/ios-account-data-architecture.md` for a focused review of an
applicable change.
