import { NavLink, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NavItem { to: string; label: string; icon: string; }

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: "📊" },
  { to: "/agenda", label: "Agenda", icon: "📅" },
  { to: "/patients", label: "Pacientes", icon: "👤" },
  { to: "/sessions", label: "Sesiones activas", icon: "🩺" },
  { to: "/rips", label: "RIPS", icon: "📋" },
  { to: "/invoices", label: "Facturas", icon: "💳" },
  { to: "/caja", label: "Caja", icon: "💵" },
  { to: "/cartera", label: "Cartera", icon: "📁" },
  { to: "/reports", label: "Reportes", icon: "📈" },
  { to: "/settings", label: "Configuración", icon: "⚙️" },
];

interface SidebarProps { onSearchClick?: () => void; }

export function Sidebar({ onSearchClick }: SidebarProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 bg-[#1E3A5F] text-white flex flex-col z-40"
      aria-label="Navegación principal"
    >
      <div className="p-6 border-b border-white/10">
        <h1 className="text-xl font-bold tracking-tight">psyque app</h1>
        <p className="text-xs text-white/50 mt-0.5">Colombia</p>
      </div>

      {/* Búsqueda global — Ctrl+K */}
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={onSearchClick}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 text-white/60 text-sm hover:bg-white/15 transition-colors"
        >
          <span>🔍</span>
          <span className="flex-1 text-left">Buscar paciente...</span>
          <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 pt-3" aria-label="Menú principal">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-[#2E86AB] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )
            }
          >
            <span className="text-base w-5 text-center" aria-hidden="true">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <span className="text-base w-5 text-center" aria-hidden="true">🚪</span>
          Cerrar sesión
        </button>
        <p className="text-xs text-white/40 text-center">v1.0.0 — Sprint 2</p>
      </div>
    </aside>
  );
}
