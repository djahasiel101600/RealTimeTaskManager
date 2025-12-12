# Local Development (No Docker)

This repository now supports running the application directly on your local machine without Docker.

The following instructions assume:

- You have a local Postgres instance available on localhost:5432
- You have a local Redis instance available on localhost:6379
- You will run the backend with a Python virtual environment and the frontend with npm/yarn

## Backend (Python / Django)

1. Create a Python virtualenv and install dependencies:

   Linux / macOS:

   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r backend/requirements.txt
   ```

   Windows (PowerShell):

   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r backend/requirements.txt
   ```

2. Create a `.env` file at the repo root (or use the `.env.example`), and set these minimal values:

   ```dotenv
   DATABASE_URL=postgresql://taskadmin:taskpass123@localhost:5432/taskmanager
   REDIS_URL=redis://localhost:6379/0
   SECRET_KEY=change-me
   DEBUG=1
   ALLOWED_HOSTS=localhost,127.0.0.1
   BACKEND_URL=http://localhost:8000
   CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
   ```

3. Create the database and user in your local Postgres instance if not present. Replace password if needed.

4. Run migrations, collect static, and create superuser:

   ```bash
   cd backend
   python manage.py migrate
   python manage.py createsuperuser
   python manage.py collectstatic --noinput
   ```

5. Run the backend using Django's runserver (or use Daphne for Channels support to better simulate production):

   Django runserver:

   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

   Daphne (recommended if using Channels & WebSockets):

   ```bash
   daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application
   ```

6. Run celery worker and beat (optional):

   ```bash
   # Terminal 1 - Worker
   celery -A task_manager worker -l info

   # Terminal 2 - Beat
   celery -A task_manager beat -l info
   ```

## Frontend (Vite + React)

1. Install dependencies and start dev server:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

2. Build for production:

   ```bash
   npm run build
   ```

## Notes & Tips

- If you prefer to use Docker for services like Postgres/Redis, reintroduce docker-compose.yml and the Dockerfiles in the old branches or commit history.
- If you are on Windows, using WSL2 to run Postgres and Redis is often easier and more consistent with Linux-based development.
- This project previously used `docker-compose` hostnames like `postgres` and `redis`. All local dev defaults use `localhost` now.
- For WebSocket development, use `daphne` locally for a more realistic environment.
