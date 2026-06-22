"use client";

import { create } from "zustand";

interface AuthState {
  session: { userId: string; email?: string } | null;
  loading: boolean;
  supabaseEnabled: boolean;
  load: () => Promise<void>;
  setSession: (session: AuthState["session"]) => void;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  loading: false,
  supabaseEnabled:
    typeof window !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  load: async () => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      set({ supabaseEnabled: false });
      return;
    }
    set({ loading: true });
    try {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      if (!supabase) {
        set({ loading: false, supabaseEnabled: false });
        return;
      }
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      set({
        session: user
          ? { userId: user.id, email: user.email }
          : null,
        loading: false,
        supabaseEnabled: true,
      });
    } catch {
      set({ loading: false });
    }
  },
  setSession: (session) => set({ session }),
  signOut: async () => {
    try {
      const { getSupabaseClient } = await import("@/lib/supabase/client");
      const supabase = getSupabaseClient();
      if (supabase) await supabase.auth.signOut();
    } finally {
      set({ session: null });
    }
  },
}));
