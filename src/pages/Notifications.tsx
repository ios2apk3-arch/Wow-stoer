import { Bell, Check } from "lucide-react";
import { Link } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, notifications } from "../platform/api";
import { Badge, Button, Card, EmptyState, cx } from "../ui";
import RequireAuth from "./RequireAuth";

const kindTones = {
  order_new: "accent",
  order_status: "info",
  quote_new: "success",
  message_new: "accent",
  price_drop: "success",
  back_in_stock: "success",
  shipping_update: "info",
  payment_update: "warning",
  ai_insight: "accent",
  rfq_new: "warning",
} as const;

function NotificationsInner() {
  const { d, t, relative } = useI18n();
  useDatabase();

  const user = auth.currentUser()!;
  const list = notifications.forUser(user.id);
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.notifications.title)}</h1>
          {unread > 0 && <p className="num mt-1 text-sm text-muted-foreground">{unread}</p>}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => notifications.markAllRead(user.id)}>
            <Check className="h-4 w-4" />
            {t(d.action.markAllRead)}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t(d.notifications.empty)} />
      ) : (
        <div className="space-y-2.5">
          {list.map((n) => (
            <Link key={n.id} to={n.href} onClick={() => notifications.markRead(n.id)}>
              <Card className={cx("p-4 transition-all hover:border-border-strong", !n.read && "border-accent/40 bg-accent-soft/30")}>
                <div className="flex items-start gap-4">
                  <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-border-strong" : "bg-accent")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-foreground">{t(n.title)}</h3>
                      <Badge tone={kindTones[n.kind]}>{n.kind.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t(n.body)}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{relative(n.at)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      {n.channels.map((c) => (
                        <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                          {t(d.notifications.channel[c])}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <NotificationsInner />
    </RequireAuth>
  );
}
