import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  wallet: string | null
  isAuthenticated: boolean
  hasHydrated: boolean
  setAuth: (token: string, wallet: string) => void
  clearAuth: () => void
  setHasHydrated: (hasHydrated: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      wallet: null,
      isAuthenticated: false,
      hasHydrated: false,
      setAuth: (token, wallet) => set({ token, wallet, isAuthenticated: true }),
      clearAuth: () => set({ token: null, wallet: null, isAuthenticated: false }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'kairo-auth',
      partialize: (state) => ({
        token: state.token,
        wallet: state.wallet,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
      },
    }
  )
)
