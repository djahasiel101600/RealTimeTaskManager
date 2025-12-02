# Use Python 3.11 slim image
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV DJANGO_SETTINGS_MODULE=task_manager.settings

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    postgresql-client \
    libpq-dev \
    curl \
    netcat-openbsd \
    gettext \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Make entrypoint executable
RUN chmod +x /app/entrypoint.sh

# Create necessary directories
RUN mkdir -p /app/static /app/media /app/logs

# Create a non-root user to run the app
RUN addgroup --system django && adduser --system --ingroup django django

# Note: Ownership will be handled by docker-compose volumes at runtime
# Don't switch to django user yet - docker-compose command needs root for migrations

# Expose port
EXPOSE 8000

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]

# Run the application (this becomes the argument to entrypoint)
CMD ["gunicorn", "--bind", "0.0.0.0:8000", "--workers", "3", "--timeout", "120", "task_manager.asgi:application", "-k", "uvicorn.workers.UvicornWorker"]