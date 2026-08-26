import { Bell, Check } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
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
  const { data, loading, refetch } = useApiQuery((signal) => api.notifications.list({ perPage: 50 }, signal), []);
  const list = data?.items ?? [];
  const unread = data?.unreadCount ?? 0;

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.notifications.title)}</h1>
          {unread > 0 && <p className="num mt-1 text-sm text-muted-foreground">{unread}</p>}
        </div>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={() => void api.notifications.markAllRead().then(refetch)}>
            <Check className="h-4 w-4" />
            {t(d.action.markAllRead)}
          </Button>
        )}
      </div>

      {loading && !list.length ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState icon={<Bell className="h-6 w-6" />} title={t(d.notifications.empty)} />
      ) : (
        <div className="space-y-2.5">
          {list.map((n) => (
            <Link key={n.id} to={n.href || "/"} onClick={() => void api.notifications.markRead(n.id).then(refetch)}>
              <Card className={cx("p-4 transition-all hover:border-border-strong", !n.read && "border-accent/40 bg-accent-soft/30")}>
                <div className="flex items-start gap-4">
                  <span className={cx("mt-1 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-border-strong" : "bg-accent")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-extrabold text-foreground">{t(n.title)}</h3>
                      <Badge tone={kindTones[n.kind as keyof typeof kindTones] ?? "neutral"}>
                        {n.kind.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{t(n.body)}</p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">{relative(n.at)}</span>
                      <span className="text-[10px] text-muted-foreground">·</span>
                      {n.channels.map((c) => (
                        <span key={c} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                          {c in d.notifications.channel
                            ? t(d.notifications.channel[c as keyof typeof d.notifications.channel])
                            : c}
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
