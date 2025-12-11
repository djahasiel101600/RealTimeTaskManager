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

## System chat messages

The backend creates "system" chat messages (persisted `Message` rows in the `chat` app) for important task events and broadcasts them to the task chat room group `task_{room.id}`. These system messages are created by `TaskViewSet.create_system_message` and are used for UI activity feeds and real-time updates.

Events that create system messages:

- Assignment changes (`assign`, `bulk_assign`, proposals/accepts/rejects)
- File attachments (`upload_attachment`, attachments POST)
- Status changes (`update_status` — includes reason for critical transitions)

Payload shape (websocket broadcast):

- `id` (int): the chat message DB id
- `content` (string): human-readable system text (e.g. "Assigned: alice")
- `sender` (object|null): sender info when available — `{id, username, avatar}` or `null` for system-only messages
- `timestamp` (ISO 8601 string): message creation time
- `room_type` (string): always `'task'` for these messages
- `room_id` (int): the chat room id
- `attachments` (array): empty list for system messages (present for consistency)

Behavioral notes:

- System message creation is best-effort: failures to persist or broadcast are logged but do not fail the primary API request.
- Tests mock `channel_layer.group_send` to assert both DB creation of `Message` rows and that the broadcast payload matches the expected shape.

If you add new system message consumers or change the payload, update the tests in `backend/apps/tasks/tests.py` accordingly.
