# Backend → Frontend Mapping (Task Manager)

Purpose: document the important HTTP endpoints, WebSocket channels, message shapes, and integration notes so the frontend stays in-sync with the Django backend.

**Auth Summary**

- **Backend auth:** JWT via `rest_framework_simplejwt`. Login and refresh endpoints return JSON tokens and ALSO set `access` and `refresh` as HttpOnly cookies.
- **Cookies:** `CORS_ALLOW_CREDENTIALS = True` — frontend should send credentialed requests when calling the API (`fetch(..., { credentials: 'include' })` or `axios` with `withCredentials`).
- **WS auth options (priority):**
  - Pass `access` token as WebSocket subprotocol: `new WebSocket(url, accessToken)` (preferred)
  - Browser cookies: HttpOnly `access` cookie is parsed server-side from `Cookie` header during handshake (works if same-site & origin permit)
  - Query string: `wss://.../ws/chat/?token=<access>` (fallback)
- `VITE_WS_USE_SUBPROTOCOL=true` — configure WebSocket subprotocol fallback to send token as `Sec-WebSocket-Protocol` header. If false, cookies or query param token is used.
- `VITE_WS_ALLOW_QUERY_TOKEN=true` — when set, the client will append `?token=<access>` to the WS URL as a last-resort fallback (useful for debugging or environments where cookies and subprotocols are not forwarded)

- Base API root: `/api/` (see per-app prefixes below).
- Default DRF page size: `20` but some endpoints accept `page`/`page_size` params.
- Throttling: anon `50/hour`, user `1000/hour`. Login and password-reset have stricter limits.

===================================
**Core (auth, health, password reset)**

- `POST /api/auth/token/` — Login (also available at `/api/auth/login/` via users router).

  - Payload: `{ "email": "...", "password": "..." }`
  - Response: `{ "access": "...", "refresh": "...", "user": { ... } }` and sets cookies `access` and `refresh` (HttpOnly).
  - Notes: capture `access` token in-memory if you need it for WS subprotocols.

- `POST /api/auth/token/refresh/`

  - Payload: `{ "refresh": "..." }` (or rely on cookie refresh if you send cookies).
  - Response: `{ "access": "..." }`, and backend sets `access` cookie.

- `POST /api/register/` or `/api/users/auth/register/` — user registration.
- `POST /api/password-reset/` — request password reset (throttled).
- `POST /api/password-reset/confirm/` — confirm reset with `{ uid, token, new_password }`.
- `GET /api/health/` — health check.

===================================
**Users** (`/api/users/`)

- `GET /api/users/` — list users (permission-filtered by role).
- `GET /api/users/{id}/` — retrieve user.
- `GET /api/users/profile/` — get current user's profile.
- `PATCH /api/users/profile/` — update current user's profile.
- `POST /api/users/profile/avatar/` — upload avatar (multipart file key `avatar`).
- `POST /api/users/{id}/change_role/` — change user role (supervisor-only).
- `GET /api/users/stats/` — stats for supervisors/ATLs.

Notes: avatar upload enforces max 5MB and allowed types `image/jpeg`, `image/png`, `image/gif`.

===================================
**Tasks** (`/api/tasks/`)

- `GET /api/tasks/` — list tasks (filter params: `status`, `priority`, `search` via query string).
- `POST /api/tasks/` — create task.
  - Body schema (JSON):
    - `title`, `description`, `priority`, `due_date` (ISO), `assigned_to_ids` (array of user IDs).
- `GET /api/tasks/{id}/` — retrieve task including `attachments` and `assigned_to` user objects.
- `PUT/PATCH /api/tasks/{id}/` — update task (use `TaskUpdateSerializer` for partial updates).

Task actions (custom endpoints):

- `POST /api/tasks/{id}/assign/` — assign users: `{ "user_ids": [1,2], "replace": true|false }`.
- `POST /api/tasks/{id}/propose_assignment/` — propose assignments: `{ "user_ids": [...] }` → creates pending assignment objects.
- `POST /api/tasks/{id}/respond_assignment/` — accept/reject proposed assignment: `{ "assignment_id": <id>, "action": "accept"|"reject", "reason": "..." }`.
- `POST /api/tasks/{id}/update_status/` — change status: `{ "status": "in_progress", "reason": "..." }` (reason required for critical transitions).
- `POST /api/tasks/{id}/upload_attachment/` — upload attachment for task (multipart file under `file` or `attachments` depending on frontend convention).

Notes: creating/updating tasks triggers activity logs, notifications to assigned users (via WebSocket), and sometimes creates system chat messages in the related task chat room.

===================================
**Chat (REST)** (`/api/chat/`)

- `GET /api/chat/rooms/` — list chat rooms for current user (annotated with `unread_count`, `last_message`).
- `POST /api/chat/rooms/` — create room. Body varies by `room_type`:
  - `direct`: `{ "room_type": "direct", "other_user_id": <id> }`
  - `task`: `{ "room_type": "task", "task_id": <id> }`
  - `group`: `{ "room_type": "group", "name": "...", "participant_ids": [ ... ] }`
- `GET /api/chat/messages/?room_id=<id>&page=<n>&page_size=<n>` — fetch messages (paginated). Response contains `{ results, count, page, page_size, has_more }`.
- `POST /api/chat/messages/` — send message (recommended for messages with file attachments):
  - Use `FormData()`; include `room` (room id), `content` (text), and file attachments. Backend accepts:
    - `attachments` array via `form.append('attachments', file)` multiple times
    - or indexed keys like `attachments[0]`, `attachments[1]` — both are supported.
  - Response: created message with `attachments` array where each item contains `file_url` (absolute URL) when available.

Notes: message broadcasting to WS is handled server-side after message create; messages created via WS (ChatConsumer) are also persisted.

===================================
**Chat (WebSocket)**

- WS endpoints: `ws://<host>/ws/chat/` and `ws://<host>/ws/chat/<room_id>/` (both supported).
- Authentication: preferred via WS subprotocol (pass `access` token), else cookies, else `?token=` query.

Client → Server message shapes (JSON):

- Join a room:
  - `{ "type": "join_room", "room_type": "task|direct|group|...", "room_id": <id> }`
  - For `direct`, `room_id` may be the other user's id; server resolves actual direct room id.
- Leave room:
  - `{ "type": "leave_room", "room_id": <id> }`
- Send a chat message (via WS):
  - `{ "type": "send_message", "room_type": "task|direct|group|...", "room_id": <id>, "message": "Hello" }`
  - Note: attachments must be sent via REST `POST /api/chat/messages/` (multipart). WS messages omit attachments.
- Typing indicator:
  - `{ "type": "typing", "room_id": <id>, "is_typing": true }`

Server → Client events (examples):

- Chat message broadcast (when server sends to clients):
  - `{"type":"chat_message","data":{ "id": 123, "content": "...", "sender": { "id":1, "username":"..", "avatar":"..." }, "timestamp":"...", "room_type":"task", "room_id":42, "attachments":[...] }}`
- Typing indicator event:
  - `{"type":"typing","data": { "user": {"id":1,"username":"..."}, "is_typing": true, "room_id": 42 }}`

Group naming convention (used by backend channel layer):

- Task room: `task_<room.id>`
- Direct room: `direct_<room.id>`
- Group room: `group_<room.id>`
- Generic room fallback: `room_<room.id>`

===================================
**Notifications (REST & WS)**

- `GET /api/notifications/` — fetch notifications for current user. Important: this endpoint marks unread notifications as read when fetched.
- `POST /api/notifications/{id}/read/` — mark single notification read.
- `POST /api/notifications/mark-all-read/` — mark all as read.
- `DELETE /api/notifications/{id}/` — delete one.
- `DELETE /api/notifications/clear-all/` — clear all notifications.

WS: `ws://.../ws/notifications/` — server will add connection to group `notifications_<user_id>` and send messages. Example payload from server:

- `{"type":"notification","data": { "id": 1, "title":"...", "message":"...", "notification_type":"deadline", "is_read": false, "created_at": "..." }}`

===================================
**Attachments & URLs**

- Attachment serializers provide `file_url` (full absolute URL) when possible. They attempt to use backend `BACKEND_URL` setting; if not set they fallback to request-based `build_absolute_uri`.
- Upload keys supported:
  - `attachments` (array via repeated `form.append('attachments', file)`) OR indexed keys `attachments[0]`, `attachments[1]`.

===================================
**Client Recommendations / Best Practices**

- Network layer:

  - Create an axios instance with `withCredentials: true` for all API calls.
  - Add an interceptor to handle 401s by calling `POST /api/auth/token/refresh/` and retrying the original request once.

- Token usage for WS:

  - Save `access` token returned by login in-memory (do NOT persist in localStorage). Use that value to open WS as subprotocol.
  - Keep cookies enabled for REST calls so backend cookie-based refresh/update works.

- WebSocket lifecycle:

  - Implement reconnect with exponential backoff.
  - On reconnect, re-send `join_room` messages for rooms the UI expects to be in.
  - When sending a message with attachments: upload via `POST /api/chat/messages/` (multipart) — the server will broadcast the message after persisting it.

- Notifications UX caveat:
  - `GET /api/notifications/` marks messages read. If UI needs to preview notifications without marking read, request a backend change or add a flag endpoint.

===================================
**Quick code snippets**

- Axios instance (example):

```js
import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { Accept: "application/json" },
});
```

- Open WebSocket with subprotocol token (example):

```js
// accessToken must be kept in-memory
const ws = new WebSocket("wss://backend.example.com/ws/chat/", accessToken);
ws.onopen = () =>
  ws.send(
    JSON.stringify({
      type: "join_room",
      room_type: "direct",
      room_id: otherUserId,
    })
  );
```

===================================
If you want, I can:

- add example axios interceptors that handle token refresh and inject in-memory `access` token for WS, or
- update `src/hooks/useWebSocket.ts` to follow the auth/fallback patterns documented here.

File created by developer tooling; keep this file updated whenever backend API shapes change.
