# Migration Notes: Containerized => Local Development

This document highlights configuration changes and compatibility notes for switching from a containerized setup to running the app locally without containers.

Key changes

- DATABASE_HOST defaults now to `localhost` instead of `postgres`.
- REDIS_URL defaults now to `redis://localhost:6379/0` instead of `redis://redis:6379/0`.
- CORS_ALLOWED_ORIGINS, ALLOWED_HOSTS defaults have been updated to only include `localhost`/127.0.0.1.
- The compose and override files were removed; check the git history to view older versions if you need to reintroduce them.
- Container build files in `frontend`/`backend` were removed; check git history (or older branches) for prior container builds if necessary.

Environment variables and compatibility

- If you previously used `POSTGRES_HOST` and `REDIS_HOST` env vars with service names (e.g., `postgres`, `redis`), update them to `localhost` and ensure your local Postgres/Redis services are accessible.

Local equivalents for services

- Postgres: Install and run locally (e.g., via system package manager, WSL2 on Windows, or plans such as Homebrew on macOS). Ensure `taskadmin` DB and `taskmanager` DB exist or create them via psql.
- Redis: Install and run Redis locally. For WSL2 users, use `sudo apt install redis` or use Windows binaries.

Running locally

- Backend: Use `python manage.py runserver 0.0.0.0:8000` or `daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application` for WebSocket support.
- Frontend: `cd frontend && npm install && npm run dev` (dev server default port is 5173).

Rollback to containerized deployments

- If you need to roll back to a containerized environment, check the compose files in previous git commits. Reintroducing container build files and compose configs (from history) allows you to run a multi-service stack locally.
