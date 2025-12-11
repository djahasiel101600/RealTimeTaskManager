import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
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
      isAuthenticated: false,
      isLoading: false,
      error: null,
      
      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          // Dynamically import to avoid circular dependency
          const { authService } = await import('@/services/api');
          const response = await authService.login(email, password);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({ 
            error: error.response?.data?.detail || 'Login failed',
            isLoading: false,
            isAuthenticated: false,
          });
          // Re-throw so the component can handle navigation logic
          throw error;
        }
      },
      
      logout: () => {
        set({
          user: null,
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
        user: state.user,
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);