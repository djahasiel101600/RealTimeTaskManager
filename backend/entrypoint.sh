#!/bin/bash

# Exit on error
set -e

# Wait for PostgreSQL to be available
echo "Waiting for PostgreSQL..."

# Parse DATABASE_URL or use individual POSTGRES_* vars
if [ -n "$DATABASE_URL" ]; then
    # Extract host and port from DATABASE_URL (format: postgresql://user:pass@host:port/db)
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
else
    DB_HOST=${POSTGRES_HOST:-postgres}
    DB_PORT=${POSTGRES_PORT:-5432}
fi

# Wait for PostgreSQL to be ready
until nc -z "$DB_HOST" "$DB_PORT"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 2
done

echo "PostgreSQL is up"

# Wait for Redis to be available
echo "Waiting for Redis..."
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

until nc -z "$REDIS_HOST" "$REDIS_PORT"; do
  echo "Redis is unavailable - sleeping"
  sleep 2
done

echo "Redis is up"

# Wait a bit more to ensure services are fully ready
sleep 2

# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Create superuser only if DJANGO_SUPERUSER_* env vars are set
if [ -n "$DJANGO_SUPERUSER_USERNAME" ] && [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
    echo "Creating superuser from environment variables..."
    python manage.py createsuperuser --noinput || true
fi

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput

# Start the Django application
exec "$@"