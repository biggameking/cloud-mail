# Decisions

Durable project decisions belong here.

## 2026-07-19 - devrules initialized

- Context: The repository adopted a project-local devrules instance.
- Decision: Official Agent entry files should point to devrules/always-readme.md while preserving their original content.
- Scope: Agent onboarding, workflow routing, memory, and automation.
- Consequence: Future Agents should read devrules before repository-specific lower-priority details.
