---
name: New prompt
description: New prompt
invokable: true
---

## Project Context Summary — RealTimeTaskManager

This file contains a concise, actionable snapshot of the repository to provide an AI with the proper context for generating tests, code changes, or other development work.

Repository

- Name: RealTimeTaskManager
- Owner: djahasiel101600
- Branch: `main`

High-level overview

- Stack: Python (Django) backend + React + TypeScript frontend (Vite)
- Frontend uses: Tailwind CSS, shadcn/ui components, Zustand, date-fns, lucide-react icons
- Backend uses: Django (ASGI configured), Celery, Redis, Postgres (DB), served via Docker Compose
- Project is containerized with `docker-compose.yml` (frontend, backend, nginx, db, redis, celery workers)

Top-level layout (important folders & files)

- `docker-compose.yml` — orchestration for local development and services
- `backend/` — Django backend

  - `manage.py`
  - `requirements.txt`
  - `Dockerfile`
  - `apps/` — Django apps such as `chat`, `core`, `notifications`, `tasks`, `users`
  - `task_manager/` — Django project settings: `settings.py`, `asgi.py`, `wsgi.py`, `urls.py`

- `frontend/` — React + Vite frontend (TypeScript)
  - `package.json`, `vite.config.ts`, `tsconfig*.json`
  - `src/`
    - `App.css` — global styles and theme (recently updated)
    - `main.tsx`, `App.tsx`
    - `components/` — UI components and pages
      - `ChatWindow.tsx`, `TaskCard.tsx`, `TaskDashboard.tsx`, `CreateTaskDialog.tsx`, `NotificationBell.tsx`, `ui/` (shadcn wrappers: `button.tsx`, `dialog.tsx`, `select.tsx`, `popover.tsx`, `avatar.tsx`, `badge.tsx`, etc.)
    - `pages/` — each route page e.g. `UsersPage.tsx`, `ActivityLogsPage.tsx`, `ProfilePage.tsx`, `ChatPage.tsx`, `NotFoundPage.tsx`, `TaskDetailPage.tsx`
    - `stores/` — Zustand stores: `auth.store.ts`, `chat.store.ts`, `task.store.ts`, `notification.store.ts`
    - `services/` — API wrappers: `api.ts` (contains `userService`, `taskService`, `chatService`, `activityLogService`)
    - `hooks/` — e.g. `useWebSocket.ts`
    - `lib/` — `utils.ts`, helper functions

Key frontend files to review before writing tests or UI work

- `src/pages/UsersPage.tsx` — User management UI, dialogs (`CreateChatDialog`, Role change, delete user), stat cards, search & filters
- `src/pages/ActivityLogsPage.tsx` — Activity list, filters, export, date range picker
- `src/components/ChatWindow.tsx` — message rendering, optimistic updates, file attachments preview helper `RetryImage`
- `src/components/CreateChatDialog.tsx` — dialog used by the Chat page to start new conversations
- `src/components/ui/dialog.tsx`, `select.tsx`, `popover.tsx` — shared Radix wrappers and style defaults (recently updated to use solid backgrounds)

Build / Run / Test commands (frontend)

- Install deps: `cd frontend` then `npm ci` (or `npm install`)
- Development: `cd frontend` then `npm run dev` (Vite)
- Build: `cd frontend` then `npm run build` (uses `tsc -b && vite build`)
- Lint / type-check: `npm run lint` / `npm run typecheck` if defined in `package.json`

Build / Run / Test commands (backend)

- Install deps: `cd backend` then `pip install -r requirements.txt`
- Run migrations/local dev: `python manage.py migrate` and `python manage.py runserver`

Docker (local)

- Orchestrate everything: from repository root run:

```powershell
docker-compose up -d --build
```

- To rebuild a single service (example frontend):

```powershell
docker-compose up -d --build --force-recreate frontend
```

Ports used (common default mapping in this repo)

- Frontend: host `3000` -> container `80` (Nginx serving built frontend)
- Backend: host `8001` -> container `8000` (Django)
- Postgres: `5432`
- Redis: `6379`

Important runtime / dev notes

- The frontend relies on several shared UI wrappers in `src/components/ui/*` (Radix + Tailwind) — edits there affect many pages.
- WebSocket logic uses `useWebSocket` hook and `chat.store`; do not change socket message formats unless updating backend handler.
- API wrappers in `src/services/api.ts` centralize service calls; many components import specific services (e.g., `userService.getUsers()`).
- When changing UI styles, check `App.css` for global variables and animation utilities.

Where to add unit tests (suggestions)

- Frontend (preferred):
  - Unit tests for pure UI helpers in `src/lib/utils.ts` and any small pure functions.
  - Component tests for rendering and behavior (React Testing Library + Vitest/Jest): `UsersPage`, `ActivityLogsPage`, `ChatWindow` (mock stores/services), `CreateChatDialog`.
  - Tests for `RetryImage` logic (image retry/backoff) in `ChatWindow`.
  - Tests for `select`, `dialog`, `popover` wrappers to ensure className changes apply correctly.
- Backend: add Django unit tests inside each app `apps/*/tests.py` for views, serializers, and model methods.

How to run frontend tests locally (if vitest/jest configured)

```powershell
cd frontend
# Example using vitest
npm run test:unit
```

Quick tips for an AI generating tests or code changes

- Prefer mocking external network calls (services in `src/services/api.ts`) and Zustand stores when unit-testing components.
- Use the component wrappers in `src/components/ui/*` as black-box building blocks — test expected DOM output and behavior rather than internal Radix behavior.
- Preserve WebSocket and auth flows: tests should mock `useWebSocket` and `useAuthStore` with predictable values.
- When altering style classes, target `App.css` or `ui/*` wrappers to keep consistent system-wide changes.

If you need more detail

- I can produce a file list of the `frontend/src` folder (recursive), or create skeleton unit test files for chosen components (e.g., `UsersPage.test.tsx`, `ChatWindow.test.tsx`) and run the test runner.

---

Generated: Snapshot for AI assistance. Update this file if new folders or major architecture changes are introduced.
