import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  tenantReady: boolean;
  authSetupError: string | null;
}

async function ensureTenantConfigured(
  session: Session
): Promise<{ session: Session; error: string | null }> {
  if (session.user.app_metadata?.tenant_id) return { session, error: null };
  if (session.user.app_metadata?.role === "patient") return { session, error: null };

  const meta = session.user.user_metadata ?? {};

  // Patient self-registration: has register_as=patient but no colpsic_number
  if (meta.register_as === "patient" && !meta.colpsic_number) {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("setup-patient-profile timeout")), 8000)
      );
      await Promise.race([api.auth.setupPatientProfile(), timeout]);
      const { data } = await supabase.auth.refreshSession();
      return { session: data.session ?? session, error: null };
    } catch (e) {
      console.error("[setup-patient-profile] error:", e);
      return { session, error: "No se pudo configurar tu cuenta. Intenta recargar." };
    }
  }

  // Google OAuth users lack colpsic_number — skip auto-setup, /complete-profile handles it
  if (!meta.colpsic_number) return { session, error: null };

  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("setup-profile timeout")), 8000)
    );
    await Promise.race([api.auth.setupProfile(), timeout]);
    const { data } = await supabase.auth.refreshSession();
    return { session: data.session ?? session, error: null };
  } catch (e) {
    console.error("[setup-profile] error:", e);
    return { session, error: "No se pudo configurar tu cuenta. Intenta recargar." };
  }
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    tenantReady: false,
    authSetupError: null,
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { session: finalSession, error: setupError } = await ensureTenantConfigured(session);
        setState({ user: finalSession.user, session: finalSession, loading: false, tenantReady: !!finalSession.user.app_metadata?.tenant_id, authSetupError: setupError });
      } else {
        setState({ user: null, session: null, loading: false, tenantReady: false, authSetupError: null });
      }
    }).catch((e) => {
      console.error("[useAuth] getSession error:", e);
      setState({ user: null, session: null, loading: false, tenantReady: false, authSetupError: null });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session && event === "SIGNED_IN") {
          const { session: finalSession, error: setupError } = await ensureTenantConfigured(session);
          setState({ user: finalSession.user, session: finalSession, loading: false, tenantReady: !!finalSession.user.app_metadata?.tenant_id, authSetupError: setupError });
        } else {
          setState({ user: session?.user ?? null, session, loading: false, tenantReady: !!session?.user?.app_metadata?.tenant_id, authSetupError: null });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
