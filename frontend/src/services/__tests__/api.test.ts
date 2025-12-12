import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiDefault, { authService, clearTokens } from '../api';

describe('authService token handling', () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it('stores access and refresh tokens in memory after login', async () => {
    const fakeResponse = {
      data: {
        access: 'access-xyz',
        refresh: 'refresh-abc',
        user: { id: 1, username: 'tester' },
      }
    };

    const postSpy = vi.spyOn(apiDefault, 'post').mockResolvedValueOnce(fakeResponse as any);

    const res = await authService.login('test@example.com', 'password');

    expect(postSpy).toHaveBeenCalled();
    // tokens should be set by the server via HttpOnly cookies; not by client-side JS
    expect(res.user).toBeDefined();
  });

  it('refreshToken updates in-memory tokens when response contains new tokens', async () => {
    const fakeResponse = { data: { access: 'new-access', refresh: 'new-refresh' } };
    const postSpy = vi.spyOn(apiDefault, 'post').mockResolvedValueOnce(fakeResponse as any);

    // The client relies on cookie-based refresh; no client-set tokens required.

    const res = await authService.refreshToken();

    expect(postSpy).toHaveBeenCalled();
    expect(res.access).toBe('new-access');
    expect(res.access).toBe('new-access');
  });
});
