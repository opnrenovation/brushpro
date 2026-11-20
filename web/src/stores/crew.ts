import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Crew app session, kept apart from the admin session so a crew member's
// phone never holds an admin token (and vice versa).
interface CrewEmployee {
  id: string;
  first_name: string;
  last_name: string;
}

interface CrewState {
  token: string | null;
  employee: CrewEmployee | null;
  _hydrated: boolean;
  setSession: (token: string, employee: CrewEmployee) => void;
  logout: () => void;
  _setHydrated: () => void;
}

export const useCrewStore = create<CrewState>()(
  persist(
    (set) => ({
      token: null,
      employee: null,
      _hydrated: false,
      _setHydrated: () => set({ _hydrated: true }),
      setSession: (token, employee) => set({ token, employee }),
      logout: () => set({ token: null, employee: null }),
    }),
    {
      name: 'brushpro-crew',
      partialize: (s) => ({ token: s.token, employee: s.employee }),
      onRehydrateStorage: () => (state) => {
        state?._setHydrated();
      },
    },
  ),
);
