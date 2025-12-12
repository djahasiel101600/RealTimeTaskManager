#!/usr/bin/env bash
set -euo pipefail
VENV_PATH=.venv
if [ ! -d "$VENV_PATH" ]; then
  python -m venv "$VENV_PATH"
fi
source "$VENV_PATH/bin/activate"
pip install -r backend/requirements.txt
cd backend
python manage.py migrate
python manage.py collectstatic --noinput
echo "Starting Daphne on port 8000"
exec daphne -b 0.0.0.0 -p 8000 task_manager.asgi:application
