import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Calendar, FileText, CreditCard, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { api } from "@/lib/api";

const portalNav = [
  { to: "/portal/dashboard", label: "Inicio", Icon: Home },
  { to: "/portal/appointments", label: "Citas", Icon: Calendar },
  { to: "/portal/sessions", label: "Sesiones", Icon: FileText },
  { to: "/portal/invoices", label: "Facturas", Icon: CreditCard },
];

export function PatientPortalLayout() {
  const navigate = useNavigate();
  const { data: me } = useQuery({
    queryKey: ["portal", "me"],
    queryFn: () => api.portal.me(),
  });

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--psy-bg, #F4F1EC)" }}>
      {/* Top navigation */}
      <nav
        className="sticky top-0 z-20 border-b px-4 md:px-8"
        style={{
          background: "var(--psy-surface, #FBF9F4)",
          borderColor: "var(--psy-line, #E5DFD3)",
        }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between h-14 gap-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {portalNav.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 px-3 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                    isActive
                      ? "font-semibold"
                      : "hover:bg-[var(--psy-bg-soft,#EFEBE3)]"
                  )
                }
                style={({ isActive }) => ({
                  color: isActive ? "var(--psy-primary, #1E3A5F)" : "var(--psy-ink-2, #64748B)",
                })}
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {me && (
              <span className="hidden md:block text-sm" style={{ color: "var(--psy-ink-3, #94A3B8)" }}>
                {me.full_name.split(" ")[0]}
              </span>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="p-2 rounded-md hover:bg-[var(--psy-bg-soft,#EFEBE3)] transition-colors"
              style={{ color: "var(--psy-ink-3, #94A3B8)" }}
              aria-label="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-8">
        <Outlet />
      </main>

      {me && (
        <div
          className="fixed bottom-0 left-0 right-0 border-t px-4 py-2 text-center text-xs"
          style={{
            background: "var(--psy-surface, white)",
            borderColor: "var(--psy-line, #E2E8F0)",
            color: "var(--psy-ink-4, #CBD5E1)",
          }}
        >
          Psicólogo: {me.psychologist_name} · {me.psychologist_city}
        </div>
      )}
    </div>
  );
}
