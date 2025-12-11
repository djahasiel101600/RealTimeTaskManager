import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiDefault, { authService, getAccessToken, getRefreshToken, setAccessToken, setRefreshToken, clearTokens } from '../api';

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
    expect(getAccessToken()).toBe('access-xyz');
    expect(getRefreshToken()).toBe('refresh-abc');
    expect(res.user).toBeDefined();
  });

  it('refreshToken updates in-memory tokens when response contains new tokens', async () => {
    const fakeResponse = { data: { access: 'new-access', refresh: 'new-refresh' } };
    const postSpy = vi.spyOn(apiDefault, 'post').mockResolvedValueOnce(fakeResponse as any);

    // set an initial refresh token
    setRefreshToken('old-refresh');

    const res = await authService.refreshToken();

    expect(postSpy).toHaveBeenCalled();
    expect(getAccessToken()).toBe('new-access');
    expect(getRefreshToken()).toBe('new-refresh');
    expect(res.access).toBe('new-access');
  });
});
