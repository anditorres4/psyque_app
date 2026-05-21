import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantReady: boolean;
}

async function ensureTenantConfigured(session: Session): Promise<Session> {
  if (session.user.app_metadata?.tenant_id) return session;
  if (session.user.app_metadata?.role === "patient") return session;

  const meta = session.user.user_metadata ?? {};

  // Patient self-registration: has register_as=patient but no colpsic_number
  if (meta.register_as === "patient" && !meta.colpsic_number) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("setup-patient-profile timeout")), 8000)
      );
      await Promise.race([api.auth.setupPatientProfile(), timeout]);
      const { data } = await supabase.auth.refreshSession();
      return data.session ?? session;
    } catch (e) {
      console.error("[setup-patient-profile] error:", e);
      return session;
    }
  }

  // Google OAuth users lack colpsic_number — skip auto-setup, /complete-profile handles it
  if (!meta.colpsic_number) return session;

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
    tenantReady: false,
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const finalSession = await ensureTenantConfigured(session);
        setState({ user: finalSession.user, session: finalSession, loading: false, tenantReady: !!finalSession.user.app_metadata?.tenant_id });
      } else {
        setState({ user: null, session: null, loading: false, tenantReady: false });
      }
    }).catch((e) => {
      console.error("[useAuth] getSession error:", e);
      setState({ user: null, session: null, loading: false, tenantReady: false });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session && event === "SIGNED_IN") {
          const finalSession = await ensureTenantConfigured(session);
          setState({ user: finalSession.user, session: finalSession, loading: false, tenantReady: !!finalSession.user.app_metadata?.tenant_id });
        } else {
          setState({ user: session?.user ?? null, session, loading: false, tenantReady: !!session?.user.app_metadata?.tenant_id });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
