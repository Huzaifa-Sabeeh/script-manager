# Script Manager

Dockerized web app to manage local scripts:
- register/edit scripts
- run scripts manually
- create recurring schedules (cron expressions via internal scheduler)

## Run

```bash
cd /home/ubuntu/script-manager
docker compose up -d --build
```

Open: `http://127.0.0.1:19000`

## Auth

Credentials are set in `.env`:
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

## Notes

- Schedules are executed by `node-cron` inside the container.
- Script paths are restricted to `ALLOWED_ROOT`.
- Script files are mounted from host `/home/ubuntu`.
