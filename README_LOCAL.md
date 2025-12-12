# Local Development (No Docker)

This repository has been converted to support local development without Docker.

Key changes:

- Default hostnames changed to `localhost` for PostgreSQL and Redis.
- Dockerfiles and compose use have been deprecated; the project can run using `python manage.py runserver` and `npm run dev` for front-end during development.
- See `docs/local_development.md` for step-by-step local setup instructions.

If you need to use Docker again for testing or CI, the project history contains prior Docker configuration that can be re-introduced.
