# Script Manager Productization Plan

## Purpose

This document is master execution plan for turning current app into redistributable, plug-and-play product.

Goals:
- preserve working app while new work lands
- isolate changes by module and phase
- track what is done, how it was done, and what broke
- move codebase toward modular architecture with OOP and SOLID principles
- support both guided users and advanced users

## Working Rules

1. Every major change belongs to one module.
2. Every module must have clear boundaries:
   - responsibilities
   - interfaces
   - dependencies
   - test surface
3. No phase may break current production flow without rollback path.
4. Every phase gets its own `Phase-X.md`.
5. Every phase file must track:
   - scope
   - implementation notes
   - bugs found
   - decisions made
   - open questions
   - completion checklist
6. Prefer composition over cross-module coupling.
7. New backend work should move toward service-layer architecture, not route-heavy inline logic.
8. New frontend work should move toward feature modules, not one large page component.

## Architecture Direction

### Backend

Target backend structure:
- `modules/`
- `core/`
- `infrastructure/`
- `shared/`

Example:

```text
server/src/
  core/
    config/
    errors/
    contracts/
  infrastructure/
    db/
    docker/
    git/
    fs/
    scheduler/
  modules/
    auth/
    scripts/
    schedules/
    runs/
    diagnostics/
    setup-wizard/
    git-auth/
  shared/
    utils/
    middleware/
```

Rules:
- route handlers stay thin
- business logic lives in services/use-cases
- persistence logic lives in repositories
- environment access centralized in config module
- external system calls behind adapters

### Frontend

Target frontend structure:
- `app/`
- `modules/`
- `shared/`

Example:

```text
client/src/
  app/
    router/
    providers/
    layout/
  modules/
    auth/
    scripts/
    schedules/
    diagnostics/
    setup-wizard/
    git-auth/
  shared/
    ui/
    forms/
    api/
    utils/
    types/
```

Rules:
- one module owns one workflow
- reusable UI stays in `shared/ui`
- API functions stay outside components
- forms use React 19 patterns consistently
- diagnostics and setup flows remain independent from main script management flows

## Product Tracks

### Track A: Guided Users

Goal: next-next-next setup with safe defaults.

Defaults:
- local Mongo in Docker
- generated secrets
- detected UID/GID
- default script root
- first admin account setup
- feature detection for Docker and Git

### Track B: Advanced Users

Goal: external Mongo, custom paths, custom auth, hardened deployment.

Options:
- external Mongo URI
- custom runtime paths
- SSH / GH CLI / token Git auth
- optional Docker integration
- custom retention and security settings

## Module List

### Module 1: Foundation and Config

Purpose:
- remove host-specific assumptions
- centralize configuration
- support portable deployment

Key outputs:
- Express 5 upgrade
- config loader and validation
- runtime path abstraction
- UID/GID-aware runtime config
- dual Mongo mode support scaffold

Status: Planned

### Module 2: Diagnostics

Purpose:
- make setup and failures visible
- reduce support burden

Key outputs:
- diagnostics API
- diagnostics UI page
- checks for Mongo, Docker, Git auth, permissions, scheduler

Status: Planned

### Module 3: Setup Wizard

Purpose:
- provide guided and advanced onboarding

Key outputs:
- first-run detection
- quick setup path
- advanced setup path
- `.env` generation/update flow
- post-setup verification

Status: Planned

### Module 4: Data Layer and Mongo Modes

Purpose:
- support external Mongo and bundled Mongo cleanly

Key outputs:
- external URI flow
- local bundled Mongo flow
- connection test and fallback handling
- migration-safe DB initialization

Status: Planned

### Module 5: Git Auth

Purpose:
- make Git operations portable and understandable

Key outputs:
- SSH mode
- GitHub CLI mode
- HTTPS token mode
- auth test flow
- auth troubleshooting UI

Status: Planned

### Module 6: Script Authoring

Purpose:
- make script creation practical for non-expert users

Key outputs:
- create-from-template flow
- inline code editor
- reusable script templates
- bash guide and examples
- file creation and chmod workflow

Status: In Progress

### Module 7: Script Execution and Scheduling

Purpose:
- keep run, scheduling, retention, and logs reliable

Key outputs:
- isolated execution service
- better run logging
- retention controls
- scheduler health checks

Status: In Progress

### Module 8: Security and Roles

Purpose:
- prepare for multi-user distribution

Key outputs:
- force password rotation
- rate limiting
- audit trail
- roles: admin/operator/viewer
- optional 2FA

Status: Planned

### Module 9: Packaging and Installer

Purpose:
- make app easy to install and upgrade

Key outputs:
- `install.sh`
- `upgrade.sh`
- release structure
- `.env.example`
- install diagnostics

Status: Planned

### Module 10: Documentation

Purpose:
- help guided users and advanced users succeed without guesswork

Key outputs:
- quick start
- advanced setup
- Git auth guide
- troubleshooting guide
- operations guide
- script authoring guide

Status: Planned

## Phase Plan

### Phase 1: Foundation Refactor

Modules:
- Module 1
- groundwork for Module 4

Objectives:
- upgrade Express 5
- extract config module
- remove `/home/ubuntu` assumptions from app code
- define runtime roots and environment validation
- prepare bundled/external Mongo switch

File:
- `docs/phases/Phase-1.md`

### Phase 2: Diagnostics and Health

Modules:
- Module 2

Objectives:
- diagnostics service
- diagnostics UI
- runtime dependency checks
- actionable error surfacing

File:
- `docs/phases/Phase-2.md`

### Phase 3: Setup Wizard

Modules:
- Module 3
- Module 4

Objectives:
- first-run entrypoint
- quick setup flow
- advanced setup flow
- local vs external Mongo decision path

File:
- `docs/phases/Phase-3.md`

### Phase 4: Git Auth and Execution Hardening

Modules:
- Module 5
- Module 7

Objectives:
- auth modes
- auth test UX
- execution identity hardening
- safer runner behavior

File:
- `docs/phases/Phase-4.md`

### Phase 5: Script Authoring Productization

Modules:
- Module 6

Objectives:
- richer editor
- template variables
- create-from-template
- better non-technical UX

File:
- `docs/phases/Phase-5.md`

### Phase 6: Security and Roles

Modules:
- Module 8

Objectives:
- roles
- audit logs
- login protections
- optional 2FA

File:
- `docs/phases/Phase-6.md`

### Phase 7: Installer and Docs

Modules:
- Module 9
- Module 10

Objectives:
- installer
- upgrader
- release-ready docs

File:
- `docs/phases/Phase-7.md`

## Definition of Done

A phase is done only when:
- scoped items are implemented
- phase file updated with exact implementation notes
- bugs encountered are logged
- unresolved issues are listed
- app still runs
- regression risk is documented

## Tracking Convention

Use these status markers in each phase file:
- `[ ]` not started
- `[~]` in progress
- `[x]` completed
- `[!]` blocked/problem

## Immediate Next Phase

Next recommended phase:
- Phase 1: Foundation Refactor

Reason:
- current app still carries environment-specific assumptions
- wizard and diagnostics will be cleaner after config/runtime cleanup
