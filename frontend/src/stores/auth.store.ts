import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { authService } from '@/services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setUser: (user: User) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(email, password);
          set({
            user: response.user,
            token: response.access,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Login failed',
            isLoading: false 
          });
        }
      },
      
      logout: () => {
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        localStorage.removeItem('auth-storage');
      },
      
      setUser: (user) => set({ user }),
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);