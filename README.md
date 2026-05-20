# Script Manager

Dockerized web app for managing server-side automation scripts.

Current features:
- register scripts by path
- create scripts from UI
- edit script contents
- run scripts manually
- schedule recurring runs
- store run history in MongoDB

## Run

```bash
cd /path/to/script-manager
docker compose up -d --build
```

Open:
- `http://127.0.0.1:19000`

## Auth

Credentials come from `.env`:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Runtime Model

App is Dockerized, but it operates against host-mounted paths.

Important env values:
- `HOST_HOME`
- `APP_UID`
- `APP_GID`
- `SCRIPT_ALLOWED_ROOT`
- `APP_ROOT`
- `SCRIPTS_ROOT`
- `LOGS_ROOT`
- `BACKUPS_ROOT`
- `CREDENTIALS_ROOT`

Script paths are restricted to `SCRIPT_ALLOWED_ROOT`.

## Mongo Modes

Two supported modes:

1. External Mongo
- set `MONGO_MODE=external`
- set `MONGODB_URI`

2. Local Mongo
- set `MONGO_MODE=local`
- configure:
  - `LOCAL_MONGO_HOST`
  - `LOCAL_MONGO_PORT`
  - `LOCAL_MONGO_DATABASE`
  - `LOCAL_MONGO_USERNAME`
  - `LOCAL_MONGO_PASSWORD`

## Notes

- Schedules run via `node-cron` inside app container.
- Host mount and runtime user come from `HOST_HOME`, `APP_UID`, and `APP_GID`.
- Runtime metadata is exposed to frontend through `/api/system/runtime-meta`.
- Run retention is controlled by:
  - `RUNS_MAX_PER_SCRIPT`
  - `RUN_RETENTION_DAYS`

## Docs

Planning and phase tracking live in:
- [docs/plan.md](/home/ubuntu/script-manager/docs/plan.md)
- [docs/phases/Phase-1.md](/home/ubuntu/script-manager/docs/phases/Phase-1.md)
