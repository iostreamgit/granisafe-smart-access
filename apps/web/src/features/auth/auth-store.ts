import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  type AuthUserDto,
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
} from '../../lib/api';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUserDto | null;
  bootstrapped: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (codes: string[]) => boolean;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      bootstrapped: false,

      async login(email, password) {
        const result = await loginRequest(email, password);
        set({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          bootstrapped: true,
        });
      },

      async logout() {
        const { accessToken, refreshToken } = get();
        try {
          if (accessToken) {
            await logoutRequest(accessToken, refreshToken ?? undefined);
          }
        } catch {
          // Ignore network errors on logout — clear local session anyway.
        }
        set({ accessToken: null, refreshToken: null, user: null, bootstrapped: true });
      },

      async hydrate() {
        const { accessToken, refreshToken } = get();
        if (!accessToken) {
          set({ bootstrapped: true, user: null });
          return;
        }

        try {
          const user = await meRequest(accessToken);
          set({ user, bootstrapped: true });
        } catch {
          if (!refreshToken) {
            set({ accessToken: null, refreshToken: null, user: null, bootstrapped: true });
            return;
          }
          try {
            const refreshed = await refreshRequest(refreshToken);
            set({
              accessToken: refreshed.accessToken,
              refreshToken: refreshed.refreshToken,
              user: refreshed.user,
              bootstrapped: true,
            });
          } catch {
            set({ accessToken: null, refreshToken: null, user: null, bootstrapped: true });
          }
        }
      },

      hasPermission(code) {
        return get().user?.permissions.includes(code) ?? false;
      },

      hasAnyPermission(codes) {
        const permissions = get().user?.permissions ?? [];
        return codes.some((code) => permissions.includes(code));
      },
    }),
    {
      name: 'granisafe-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
      }),
    },
  ),
);
