## WebSocket Authentication

This app expects client WebSocket connections to provide the JWT access token via the WebSocket `Sec-WebSocket-Protocol` header (subprotocol). This is more secure than sending the token in the URL query string because query strings may be logged by proxies.

Client guidance (frontend):

- Construct the WebSocket URL without query params, then pass the JWT as the `protocol` argument to the `WebSocket` constructor.
  Example (browser):

  ```ts
  const wsUrl = "wss://example.com/ws/chat/";
  const socket = new WebSocket(wsUrl, accessToken);
  ```

Server behavior (backend):

- The consumer will first check `scope['subprotocols']` for a token and use it when present.
- For backwards compatibility, the consumer will fall back to parsing `scope['query_string']` for a `token` parameter if no subprotocol is present.
- The token is validated using `rest_framework_simplejwt` (`UntypedToken` + `TokenBackend`) so expiry and blacklist settings are honored.

Security notes:

- Sending tokens in subprotocols is better than query strings, but storing tokens in memory on the client still has risk. For high-security deployments consider using HttpOnly secure cookies for session authentication and CSRF protections for HTTP endpoints.
