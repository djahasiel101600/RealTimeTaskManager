# Notifications & WebSocket Contract

This document describes the runtime contract used by the backend and the expectations for frontend clients. It is developer-facing and intended to make real-time events predictable and testable.

---

## Group names (channel layer)

- Per-user notification group: `notifications_{user_id}`
  - Used for one-to-one notification delivery (deadline reminders, status changes, file attached, etc.).
- Chat groups (used by chat consumer):
  - Direct chat: `direct_{room_id}`
  - Task chat: `task_{room_id}`
  - Group chat: `group_{room_id}`
  - Generic fallback: `room_{room_id}`

Keep these names stable: frontend clients subscribe to them indirectly via Consumers.

---

## Notification WebSocket event (canonical)

The `NotificationConsumer` expects group messages in this shape (this is what the frontend receives):

- Consumer handler: `send_notification(self, event)`
- Outbound JSON to client:

{
"type": "notification",
"data": {
"id": 123,
"title": "Task Overdue",
"message": "Task \"Report\" is now overdue.",
"notification_type": "overdue",
"is_read": false,
"created_at": "2025-12-11T08:12:34.123456Z",
// optional: any extra data for client routing
"data": { "task_id": 42 }
}
}

Notes:

- The group_send that backend code should call must use `type: 'send_notification'` and a `data` key containing the payload. The helper `send_notification_ws(user_id, data)` wraps this correctly.
- Frontend should expect `type: 'notification'` (top-level) with a `data` object.

---

## Normalized server-side helper

Use the centralized helper `send_notification_ws(user_id, data)` (defined in `apps.notifications.models`) from anywhere on the server (views, signals, Celery tasks). This helper ensures the event type and payload key match what `NotificationConsumer` expects.

Example usage (server):

send_notification_ws(user.id, {
'id': notification.id,
'title': notification.title,
'message': notification.message,
'notification_type': notification.type,
'is_read': notification.is_read,
'created_at': notification.created_at.isoformat(),
'data': { 'task_id': task.id }
})

This repository has been updated so Celery tasks call `send_notification_ws(...)` instead of calling `channel_layer.group_send(...)` directly.

---

## Authentication expectations for WebSocket connections

- Preferred: send the JWT access token in the Sec-WebSocket-Protocol (subprotocol) when opening the WebSocket handshake. The backend checks `scope['subprotocols']` first.
- Fallback 1: HttpOnly cookie named `access` (the consumer will try to parse cookies from headers).
- Fallback 2: Query parameter `?token=<jwt>` (least preferred).

Implementation notes for frontend:

- Keep the access token in-memory (not in persistent storage) for use with WebSocket subprotocols. The HTTP client may use cookie-based refresh tokens and `axios` with a refresh interceptor; still keep a short-lived in-memory token for WS auth.
- When you open a WebSocket, include the token as a subprotocol:

Example (browser WebSocket):

const ws = new WebSocket(wsUrl, accessToken ? [accessToken] : []);

- The backend uses HS256 JWTs signed with `settings.SECRET_KEY` and expects the token payload to include `user_id`.

---

## Event types and recommended shapes (summary)

- Notifications (delivered to `notifications_{user_id}`):

  - top-level `type`: `notification`
  - payload key: `data` (object)
  - canonical fields: `id`, `title`, `message`, `notification_type`, `is_read`, `created_at`, `data` (optional JSON)

- Chat messages (delivered to chat groups):

  - top-level `type`: `chat_message`
  - payload key: `data` with full message representation

- Typing indicators: `type`: `typing`, payload key: `data` with user info and `is_typing` boolean

- Errors sent to clients:
  - `type`: `error`
  - `data`: { message: "human friendly" }

Keep the top-level `type` stable so frontend routing of incoming events stays simple.

---

## Frontend recommendations (short list)

- WebSocket:

  - Send token in subprotocol when available; fall back to cookie.
  - Reconnect/backoff strategy and de-dup incoming notifications (notification `id`) to avoid duplicates caused by reconnection.

- API / Types:

  - Generate a TypeScript client or types from the DRF serializers / OpenAPI schema. Add `drf-spectacular` and generate an OpenAPI JSON schema, then run `openapi-typescript` or `openapi-generator` to produce typed models.
  - Keep the notification payload type centralized (e.g., `src/types/notifications.ts`) and import the generated typesignal if possible.

- Status updates:
  - Use a single backend endpoint for status updates (for example `POST /tasks/{id}/update_status/` with `{status, reason?}`) and always route UI flows through your `taskService.updateTaskStatus(id, status, reason?)` helper.

---

## Server-side suggestions (quick wins)

- Always use `send_notification_ws(...)` from signals, views and tasks to avoid mismatched event envelopes.
- Add structured logging around notification dispatch failures and include `user_id`, `notification_id` and exception details.
- Add unit tests that patch `channels.layers.get_channel_layer` to an `InMemoryChannelLayer` and assert the group message was sent with `type: 'send_notification'` and the expected `data` object.

Example pytest snippet (Django + Channels testing):

from channels.testing import ApplicationCommunicator
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import send_notification_ws

# Use settings override to use in-memory layer in tests

channel*layer = get_channel_layer()
async_to_sync(channel_layer.group_send)(
f"notifications*{user.id}",
{ 'type': 'send_notification', 'data': { 'id': 1, ... } }
)

---

## Migration steps for existing code

1. Replace direct `channel_layer.group_send(...)` calls in any code paths with `send_notification_ws(user_id, data)`.
2. Ensure all created `Notification` objects use `type` (the model field) and optionally `data` JSON for extra fields.
3. Run unit tests that mock channel layer and confirm `send_notification_ws` is used.

---

## Troubleshooting

- If clients do not receive messages:
  - Verify the worker process executing `send_notification_ws` has access to the same channel layer configuration (same Redis instance).
  - Confirm the `notifications_{user_id}` group name matches the consumer subscription for that user.
  - Check logs for `Failed to send WebSocket notification` errors (server logs). Add more context if needed.

---

## References / Next steps

- Consider adding `drf-spectacular` and an `npm` script to generate TypeScript types automatically.
- Add `docs/notifications.md` to the developer onboarding checklist.
