# Backend Local Development

This document contains quick commands to set up and run the backend locally without Docker.

Prereqs:

- Python 3.11
- Postgres running locally (localhost:5432)
- Redis running locally (localhost:6379)

Commands:

```bash
# Create venv and install
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Create database & user or configure your local DB accordingly

# Configure `.env` (copy from .env.example) and set DATABASE_URL, REDIS_URL, SECRET_KEY, DEBUG=1

# Apply migrations and create superuser
python manage.py migrate
python manage.py createsuperuser

# Start Django (runserver) or Daphne for WebSocket support
python manage.py runserver 0.0.0.0:8000
# or
daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application
```

Celery worker (optional):

```bash
# From repo root
celery -A task_manager worker -l info
celery -A task_manager beat -l info
```
