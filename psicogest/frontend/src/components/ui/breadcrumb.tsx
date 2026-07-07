import { Link } from "react-router-dom";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <span className="psy-mono text-[11px]" style={{ color: "var(--psy-ink-4)" }}>›</span>
          )}
          {item.href ? (
            <Link
              to={item.href}
              className="psy-mono text-[12px] transition-colors hover:underline"
              style={{ color: "var(--psy-ink-3)" }}
            >
              {item.label}
            </Link>
          ) : (
            <span className="psy-mono text-[12px]" style={{ color: "var(--psy-ink-2)" }}>
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
