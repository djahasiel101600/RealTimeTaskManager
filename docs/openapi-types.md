# Generating TypeScript types from DRF OpenAPI

Purpose: keep frontend TypeScript models in sync with the Django REST Framework serializers by generating types from an OpenAPI schema.

Recommended stack:

- Backend: `drf-spectacular` (install into backend Python env)
- Frontend: `openapi-typescript` (npm package) or `openapi-generator` for broader client generation

Quick steps:

1. Install `drf-spectacular` on the backend and add configuration:

- Install:
  pip install drf-spectacular

- Add to `settings.py`:

REST_FRAMEWORK = {
'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}
SPECTACULAR_SETTINGS = {
'TITLE': 'Task Manager API',
'DESCRIPTION': 'OpenAPI schema for the Task Manager backend',
'VERSION': '1.0.0',
}

- Add URL to expose schema (example):

from drf_spectacular.views import SpectacularAPIView
urlpatterns += [
path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
]

2. Generate OpenAPI JSON when backend is running:

- PowerShell script (provided): `scripts/generate-ts-from-openapi.ps1`

3. Use `openapi-typescript` to create a TypeScript types file:

- From `frontend` folder:
  npx openapi-typescript http://localhost:8000/api/schema/ -o src/types/openapi.ts

4. Import the generated types in frontend code and map to local types or use them directly.

Additional frontend integration note:

- Add a route and page for assignment proposals: `/assignments/proposals` (see `frontend/src/pages/AssignmentProposalsPage.tsx`).
- After generating types, consider importing `src/types/openapi.ts` into `frontend/src/types/` and mapping API responses to generated interfaces to reduce future mismatches.

Notes:

- You may prefer `openapi-generator` to generate a typed client (Axios or Fetch). That is heavier but gives a full client.
- Keep generated files out of manual edits; commit generated types to version control if you want reproducible builds.
