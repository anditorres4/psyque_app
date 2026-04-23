import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

async function ensureTenantConfigured(session: Session): Promise<Session> {
  if (session.user.app_metadata?.tenant_id) return session;
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("setup-profile timeout")), 8000)
    );
    await Promise.race([api.auth.setupProfile(), timeout]);
    const { data } = await supabase.auth.refreshSession();
    return data.session ?? session;
  } catch (e) {
    console.error("[setup-profile] error:", e);
    return session;
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const finalSession = await ensureTenantConfigured(session);
        setState({ user: finalSession.user, session: finalSession, loading: false });
      } else {
        setState({ user: null, session: null, loading: false });
      }
    }).catch((e) => {
      console.error("[useAuth] getSession error:", e);
      setState({ user: null, session: null, loading: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session && event === "SIGNED_IN") {
          const finalSession = await ensureTenantConfigured(session);
          setState({ user: finalSession.user, session: finalSession, loading: false });
        } else {
          setState({ user: session?.user ?? null, session, loading: false });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
