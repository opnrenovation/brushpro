import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'OWNER' | 'ADMIN';
}

interface AuthState {
  token: string | null;
  user: User | null;
  must_change_password: boolean;
  setAuth: (token: string, user: User, must_change_password?: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      must_change_password: false,
      setAuth: (token, user, must_change_password = false) => {
        // Also set cookie for middleware
        if (typeof document !== 'undefined') {
          document.cookie = `brushpro_token=${token}; path=/; max-age=${7 * 24 * 3600}; SameSite=Lax`;
        }
        set({ token, user, must_change_password });
      },
      logout: () => {
        if (typeof document !== 'undefined') {
          document.cookie = 'brushpro_token=; path=/; max-age=0';
        }
        set({ token: null, user: null, must_change_password: false });
      },
    }),
    { name: 'brushpro-auth' }
  )
);
