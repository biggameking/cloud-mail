---
title: UI Design System
description: Pattern for design principles, tokens, components, layout, states, motion, accessibility, and file mapping.
ownership: seed
governs: product
activation: conditional
enforcement: example
decision_owner: project
side_effects: none
applies_to:
  - web apps
  - desktop apps
  - mobile-adapted web apps
  - admin consoles
  - component libraries
use_when:
  - A project needs consistent visual language and reusable component behavior.
do_not_use_when:
  - The project already has a complete design system and the task only uses it.
outputs:
  - design principles
  - token map
  - component inventory
  - state checklist
  - accessibility checklist
case_sources:
  - structureUI/apps/web
  - DeGit/src/components/business
  - NovelEditor/src/components/ui
  - NovelWiki/src/components/ui
  - FrameCast/src/dashboard
related_workflows:
  - devrules/workflows/browser-automation-fix.md
last_reviewed: 2026-06-11
---

# UI Design System

A design system is a behavioral contract for product UI. It is more than colors and buttons.

## Foundations

Define:

- typography scale
- spacing scale
- color roles
- elevation/shadow usage
- border radius
- icon style
- density modes
- content width rules
- responsive breakpoints
- motion rules

Use product intent to guide density. Operational tools should be scannable and calm. Creative tools can be more expressive where it helps the task.

## Tokens

Token categories:

- color: background, surface, border, text, accent, danger, warning, success
- type: family, size, weight, line height
- spacing: page, section, component, inline
- radius
- shadow
- z-index
- motion duration and easing

Prefer semantic token names over raw color names.

## Component Inventory

Core product components:

- buttons and icon buttons
- inputs and text areas
- select, combobox, menu
- tabs and segmented controls
- tables and list rows
- cards for repeated items only
- dialog, drawer, popover
- toast and inline alert
- empty state
- loading skeleton
- permission denied state
- destructive confirmation

## Component States

Every important component should define:

- default
- hover/focus
- active
- disabled
- loading
- error
- success
- empty
- permission denied
- destructive

## Accessibility

Check:

- keyboard navigation
- focus visibility
- label association
- contrast
- hit target size
- reduced motion
- screen reader names
- error announcement
- no color-only state

## File Mapping

Document where the project keeps:

- tokens
- global styles
- shared components
- icons
- layout primitives
- feature components
- tests/stories/previews

## Review Checklist

- Tokens are semantic and reusable.
- Repeated UI uses shared components.
- Components have stable dimensions where dynamic content would cause layout shift.
- Accessibility is part of component definition.
- Visual changes are verified in representative viewports.
