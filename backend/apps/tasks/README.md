## Update Status API

Endpoint: `POST /api/tasks/{id}/update_status/`

Purpose:

- Update a task's `status` field.
- Critical transitions (e.g., `done`, `cancelled`) require a `reason` which is saved to the task's `ActivityLog` and appended to the system chat message.

Request body (JSON):

- `status` (string) - required. Must be one of the task `Status` choices: `todo`, `in_progress`, `review`, `done`, `cancelled`.
- `reason` (string) - optional, but required when `status` is `done` or `cancelled`.

Example (required reason):

POST /api/tasks/42/update_status/
{
"status": "cancelled",
"reason": "Duplicate task"
}

Response:

- 200 OK with serialized `Task` object on success.
- 400 Bad Request when validation fails (invalid status, missing reason for critical transition, or invalid transition).

Behavior:

- The change is recorded in `ActivityLog.details` as JSON including `old_status`, `new_status`, and (when provided) `reason`.
- A persisted system chat `Message` is created in the task's chat room (if present) and broadcast to the room; the `reason` is included in the message content.

Notes for frontend implementers:

- Include `reason` when performing transitions that finalize or cancel work.
- The `update_status` endpoint uses a `StatusUpdateSerializer` server-side to validate inputs.
