# Phase-1: Foundation Refactor

## Summary

Stabilize runtime foundation for redistribution. Remove environment-specific assumptions. Prepare app for wizard, diagnostics, and portable deployment.

## Scope

- [x] Upgrade backend from Express 4.x to Express 5.x
- [x] Introduce centralized config module with validation
- [x] Remove hardcoded `/home/ubuntu` assumptions from app logic
- [x] Define runtime roots for scripts, logs, backups, and optional credentials
- [x] Prepare dual Mongo mode contract: bundled vs external
- [x] Separate route logic from service/config concerns where touched

## Modules Covered

- Module 1: Foundation and Config
- groundwork for Module 4: Data Layer and Mongo Modes

## Design Notes

- Config must load once and be injectable/consumable across modules.
- Runtime paths must come from env/config, not from user-specific source code assumptions.
- Changes in this phase must preserve current working behavior by default.
- New abstractions should reduce future wizard complexity.

## Implementation Notes

- 2026-05-20: Added centralized config module at `server/src/core/config.js`.
- 2026-05-20: Moved app host, port, auth, Mongo, runtime, and script retention settings behind config access.
- 2026-05-20: Added portable env contract for `HOST_HOME`, `APP_UID`, `APP_GID`, `SCRIPT_ALLOWED_ROOT`, and `MONGO_MODE`.
- 2026-05-20: Upgraded backend dependency target from Express 4.x to Express 5.x.
- 2026-05-20: Updated SPA catch-all route to regex-based handler compatible with Express 5.
- 2026-05-20: Parameterized `docker-compose.yml` user/home mount values to reduce hardcoded host assumptions.
- 2026-05-20: Split backend into models, middleware, auth routes, script routes/services, schedule routes/services, and system routes.
- 2026-05-20: Added runtime root config for app/scripts/logs/backups/credentials.
- 2026-05-20: Added runtime metadata API and switched client script hints/templates away from hardcoded `/home/ubuntu` paths.

## Bugs Found

- 2026-05-20: Git auth inside container failed because runtime user did not match host user.
  - cause: container ran as wrong UID/GID and could not read host auth config.
  - fix: map container to host UID/GID and install `gh`.
  - follow-up: replace hardcoded runtime assumptions with formal config and diagnostics.

- 2026-05-20: Script execution failed from Git safe directory checks.
  - cause: Git repo ownership mismatch in containerized execution context.
  - fix: add safe directory handling in script.
  - follow-up: solve at runtime policy/config level where possible.

- 2026-05-20: Input typing caused page remount/refresh feel.
  - cause: component identity issue from in-component `Card` definition.
  - fix: move shared component to module scope.
  - follow-up: continue frontend modularization to reduce state coupling.

## Decisions

- Decision: start redistribution work with foundation instead of wizard.
  - reason: wizard will become brittle if config/runtime model is still unstable.
  - tradeoff: less visible user-facing progress in short term, stronger base long term.

- Decision: track work phase-by-phase in dedicated docs.
  - reason: keeps implementation notes, bugs, and decisions discoverable.
  - tradeoff: small process overhead.

## Open Questions

- Should local Mongo be enabled automatically in Quick Setup when Docker socket is available, or only after explicit wizard choice?
- Should runtime roots default to `/opt/script-manager/...` on all Linux installs?
- Should script execution eventually move to dedicated runner service instead of app container?

## Risks

- Express 5 upgrade may reveal route or middleware behavior changes.
- Config extraction may touch many existing files quickly unless phased carefully.
- Runtime path migration may break current local assumptions if compatibility defaults are not preserved.

## Verification

- Current app boots after each step.
- Existing Dockerized deployment still builds.
- `GET /api/auth/me` returns successfully after Express 5 upgrade.
- Container logs confirm successful boot on `0.0.0.0:19000`.
- `GET /api/system/runtime-meta` available for frontend runtime hints.

## Completion Checklist

- [x] Express 5 upgrade complete
- [x] config module added
- [x] path assumptions removed or isolated
- [x] dual Mongo config contract added
- [x] app still works
- [x] docs updated with exact implementation notes
