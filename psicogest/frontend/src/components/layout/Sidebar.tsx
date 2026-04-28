import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Calendar, Users, Activity, FileText,
  CreditCard, BarChart3, Settings, LogOut, Search, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";

interface NavItem {
  to: string;
  label: string;
  Icon: LucideIcon;
  live?: boolean;
  indent?: boolean;
  group: "practice" | "admin";
}

const navItems: NavItem[] = [
  { to: "/dashboard",      label: "Dashboard",        Icon: LayoutDashboard, group: "practice" },
  { to: "/agenda",         label: "Agenda",           Icon: Calendar,        group: "practice" },
  { to: "/patients",       label: "Pacientes",        Icon: Users,           group: "practice" },
  { to: "/sessions",       label: "Sesiones activas", Icon: Activity,        group: "practice", live: true },
  { to: "/rips",           label: "RIPS",             Icon: FileText,        group: "admin" },
  { to: "/invoices",       label: "Facturas",         Icon: CreditCard,      group: "admin" },
  { to: "/invoices/bulk",  label: "Facturación masa", Icon: CreditCard,      group: "admin", indent: true },
  { to: "/cartera",        label: "Cartera",          Icon: FileText,        group: "admin" },
  { to: "/caja",           label: "Caja",             Icon: CreditCard,      group: "admin" },
  { to: "/reports",        label: "Reportes",         Icon: BarChart3,       group: "admin" },
  { to: "/settings",       label: "Configuración",    Icon: Settings,        group: "admin" },
];

interface SidebarProps { onSearchClick?: () => void; }

export function Sidebar({ onSearchClick }: SidebarProps) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const practiceItems = navItems.filter((i) => i.group === "practice");
  const adminItems = navItems.filter((i) => i.group === "admin");

  const linkClass = ({ isActive }: { isActive: boolean }, indent = false) =>
    cn(
      "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13.5px] font-medium transition-colors",
      indent && "pl-8",
      isActive ? "font-semibold" : "hover:bg-[var(--psy-bg-soft)]"
    );

  return (
    <aside
      className="fixed left-0 top-0 h-full w-60 flex flex-col px-3.5 py-4 gap-3.5 z-40"
      style={{
        background: "var(--psy-surface)",
        borderRight: "1px solid var(--psy-line)",
        color: "var(--psy-ink-2)",
      }}
      aria-label="Navegación principal"
    >
      {/* Brand */}
      <div className="flex items-center gap-2.5 pb-3 border-b" style={{ borderColor: "var(--psy-line)" }}>
        <div
          className="w-[30px] h-[30px] rounded-lg grid place-items-center text-white shrink-0"
          style={{ background: "linear-gradient(135deg, var(--psy-primary), var(--psy-primary-soft))" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2c-3 4-6 6-6 11a6 6 0 0 0 12 0c0-5-3-7-6-11z" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="psy-serif text-[19px]" style={{ color: "var(--psy-ink-1)" }}>psyque</div>
          <div className="psy-mono text-[10px] uppercase tracking-wider" style={{ color: "var(--psy-ink-3)" }}>
            CO · Colombia
          </div>
        </div>
      </div>

      {/* Búsqueda global */}
      <button
        type="button"
        onClick={onSearchClick}
        className="flex items-center gap-2 px-2.5 py-2 rounded-md text-[13px] transition-colors hover:border-[var(--psy-line-strong)]"
        style={{
          background: "var(--psy-bg-soft)",
          border: "1px solid var(--psy-line)",
          color: "var(--psy-ink-3)",
        }}
      >
        <Search size={14} />
        <span className="flex-1 text-left">Buscar paciente, sesión…</span>
        <kbd
          className="psy-mono text-[10px] px-1.5 py-0.5 rounded"
          style={{ background: "var(--psy-surface-2, #fff)", border: "1px solid var(--psy-line)", color: "var(--psy-ink-3)" }}
        >⌘K</kbd>
      </button>

      <NavGroup label="Práctica">
        {practiceItems.map((it) => (
          <NavItemLink key={it.to} item={it} linkClass={linkClass} />
        ))}
      </NavGroup>

      <NavGroup label="Administración">
        {adminItems.map((it) => (
          <NavItemLink key={it.to} item={it} linkClass={linkClass} />
        ))}
      </NavGroup>

      <div className="mt-auto pt-3.5 border-t flex flex-col gap-2" style={{ borderColor: "var(--psy-line)" }}>
        <div className="flex items-center gap-2.5 p-2">
          <div
            className="w-[30px] h-[30px] rounded-full grid place-items-center text-[12px] font-semibold shrink-0"
            style={{
              background: "var(--psy-sage-bg)",
              color: "var(--psy-primary)",
              border: "1px solid var(--psy-sage-soft)",
            }}
          >PS</div>
          <div className="overflow-hidden">
            <div className="text-[13px] font-semibold leading-tight truncate" style={{ color: "var(--psy-ink-1)" }}>
              Psicólogo
            </div>
            <div className="psy-mono text-[10px]" style={{ color: "var(--psy-ink-3)" }}>PSI · Colombia</div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] hover:bg-[var(--psy-bg-soft)] transition-colors"
          style={{ color: "var(--psy-ink-2)" }}
        >
          <LogOut size={14} />
          Cerrar sesión
        </button>

        <div
          className="psy-mono text-[10px] flex justify-between px-1.5"
          style={{ color: "var(--psy-ink-4)" }}
        >
          <span>v2.4 · sprint 7</span>
          <span className="flex items-center gap-1"><span className="psy-live-dot" /> sync</span>
        </div>
      </div>
    </aside>
  );
}

function NavGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="psy-mono text-[10px] uppercase tracking-wider px-2 pb-1 pt-2"
        style={{ color: "var(--psy-ink-4)" }}
      >{label}</div>
      <nav className="flex flex-col gap-px">{children}</nav>
    </div>
  );
}

function NavItemLink({
  item, linkClass,
}: {
  item: NavItem;
  linkClass: (s: { isActive: boolean }, indent?: boolean) => string;
}) {
  const Icon = item.Icon;
  return (
    <NavLink
      to={item.to}
      end={item.to === "/dashboard"}
      className={(s) => linkClass(s, item.indent)}
      style={({ isActive }) => ({
        background: isActive ? "var(--psy-sage-bg)" : "transparent",
        color: isActive ? "var(--psy-primary)" : "var(--psy-ink-2)",
      })}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span
              className="absolute left-[-14px] top-2 bottom-2 w-[3px] rounded-r"
              style={{ background: "var(--psy-sage)" }}
            />
          )}
          <Icon size={16} className="opacity-85 shrink-0" />
          <span>{item.label}</span>
          {item.live && <span className="psy-live-dot ml-auto" />}
        </>
      )}
    </NavLink>
  );
}
