# Local Development (No containerization)

This repository has been converted to support local development without containerization.

Key changes:

- Default hostnames changed to `localhost` for PostgreSQL and Redis.
- Container build files and compose configs were removed; the project can run using `python manage.py runserver` and `npm run dev` for front-end during development.
- See `docs/local_development.md` for step-by-step local setup instructions.

If you need to use containers again for testing or CI, the project history contains prior container configuration that can be re-introduced.
