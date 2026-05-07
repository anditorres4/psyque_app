import { Bell, Calendar, FileCheck, type LucideIcon } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type { NotificationOut } from "@/lib/api";

const TYPE_ICONS: Record<string, LucideIcon> = {
  new_booking_request: Calendar,
  session_signed: FileCheck,
  appointment_created: Calendar,
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

interface RowProps {
  notification: NotificationOut;
  onMarkRead: (id: string) => void;
}

function NotificationRow({ notification: n, onMarkRead }: RowProps) {
  const unread = !n.read_at;
  const Icon = TYPE_ICONS[n.type] ?? Bell;
  return (
    <div
      className="px-4 py-3 flex gap-3 cursor-pointer hover:bg-[var(--psy-bg-soft)] transition-colors"
      style={unread ? { background: "color-mix(in srgb, var(--psy-info) 5%, var(--psy-surface))" } : undefined}
      onClick={() => unread && onMarkRead(n.id)}
    >
      <Icon size={14} className="shrink-0 mt-1" style={{ color: "var(--psy-ink-3)" }} />
      <div className="min-w-0 flex-1">
        <p
          className={unread ? "text-sm font-semibold leading-snug" : "text-sm font-normal leading-snug"}
          style={{ color: "var(--psy-ink-1)" }}
        >
          {n.title}
        </p>
        {n.body && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--psy-ink-3)" }}>
            {n.body}
          </p>
        )}
        <p className="text-[10px] mt-1 psy-mono" style={{ color: "var(--psy-ink-4)" }}>
          {relativeTime(n.created_at)}
        </p>
      </div>
      {unread && (
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-1.5"
          style={{ background: "var(--psy-info)" }}
        />
      )}
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: Props) {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

  const handleMarkAllRead = () => {
    markAllRead();
    onClose();
  };

  return (
    <div
      className="absolute right-0 top-full mt-2 w-80 rounded-lg shadow-xl border overflow-hidden z-50"
      style={{ background: "var(--psy-surface)", borderColor: "var(--psy-line)" }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: "var(--psy-line)" }}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--psy-ink-1)" }}>
          Notificaciones
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs hover:underline"
            style={{ color: "var(--psy-info)" }}
          >
            Marcar todo como leído
          </button>
        )}
      </div>

      <div className="max-h-[360px] overflow-y-auto divide-y" style={{ borderColor: "var(--psy-line)" }}>
        {isLoading && (
          <p className="px-4 py-6 text-sm text-center" style={{ color: "var(--psy-ink-3)" }}>
            Cargando...
          </p>
        )}
        {!isLoading && notifications.length === 0 && (
          <p className="px-4 py-8 text-sm text-center" style={{ color: "var(--psy-ink-3)" }}>
            Sin notificaciones
          </p>
        )}
        {notifications.map((n) => (
          <NotificationRow key={n.id} notification={n} onMarkRead={markRead} />
        ))}
      </div>
    </div>
  );
}
