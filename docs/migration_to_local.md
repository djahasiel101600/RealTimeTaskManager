# Migration Notes: Docker => Local Development

This document highlights configuration changes and compatibility notes for switching from Docker to running the app locally without containers.

Key changes

- DATABASE_HOST defaults now to `localhost` instead of `postgres`.
- REDIS_URL defaults now to `redis://localhost:6379/0` instead of `redis://redis:6379/0`.
- CORS_ALLOWED_ORIGINS, ALLOWED_HOSTS defaults have been updated to only include `localhost`/127.0.0.1.
- The `docker-compose` and `docker-compose.override.yml` files have been deprecated; a `.removed` file or note exists in the repo for reference.
- Dockerfiles in `frontend`/`backend` have been replaced with deprecation notes; they are not used by default but remain in the repo for historical reasons.

Environment variables and compatibility

- If you previously used `POSTGRES_HOST` and `REDIS_HOST` env vars with service names (e.g., `postgres`, `redis`), update them to `localhost` and ensure your local Postgres/Redis services are accessible.

Local equivalents for services

- Postgres: Install and run locally (e.g., via system package manager, WSL2 on Windows, or plans such as Homebrew on macOS). Ensure `taskadmin` DB and `taskmanager` DB exist or create them via psql.
- Redis: Install and run Redis locally. For WSL2 users, use `sudo apt install redis` or use Windows binaries.

Running locally

- Backend: Use `python manage.py runserver 0.0.0.0:8000` or `daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application` for WebSocket support.
- Frontend: `cd frontend && npm install && npm run dev` (dev server default port is 5173).

Rollback to Docker

- If you need to roll back to Docker for any reason, check the `docker-compose.yml` in previous git commits or check `docker-compose.yml.removed` for the migration note. Reintroducing Dockerfiles and compose files allows you to run the same multi-service stack locally.
