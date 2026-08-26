import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Link } from "../app/router";
import { useI18n } from "../i18n";
import { auth } from "../platform/api";
import { api } from "../platform/remote/endpoints";
import { useApiQuery } from "../platform/remote/useApi";
import { RfqStatusBadge } from "../components/StatusBadge";
import { Button, Card, EmptyState, Select } from "../ui";
import RequireAuth from "./RequireAuth";
import type { RfqStatus } from "../platform/types";

const statuses: (RfqStatus | "all")[] = ["all", "open", "quoted", "awarded", "closed", "expired"];

function RfqListInner() {
  const { d, t, n, money, date } = useI18n();
  const [filter, setFilter] = useState<RfqStatus | "all">("all");
  const user = auth.currentUser();

  // Scoped server-side: buyers see their own, suppliers only those they were
  // invited to, admins see everything.
  const { data, loading } = useApiQuery(
    (signal) => api.rfq.list({ status: filter === "all" ? undefined : filter, perPage: 50 }, signal),
    [filter],
  );
  const filtered = data?.items ?? [];

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.rfq.title)}</h1>
          <p className="num mt-1 text-sm text-muted-foreground">
            {loading ? t(d.common.loading) : n(data?.total ?? 0)}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Select value={filter} onChange={(e) => setFilter(e.target.value as RfqStatus | "all")} className="h-9 w-auto text-xs">
            {statuses.map((s) => (
              <option key={s} value={s}>{s === "all" ? t(d.common.all) : t(d.rfq.statuses[s])}</option>
            ))}
          </Select>
          {user?.role !== "supplier" && (
            <Link to="/rfq/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                {t(d.rfq.new)}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {loading && !filtered.length ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border bg-muted/50" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={t(d.rfq.noRfqs)}
          action={
            user?.role !== "supplier" ? (
              <Link to="/rfq/new">
                <Button>{t(d.rfq.new)}</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const quoteCount = r.quoteCount ?? 0;
            const best = r.bestQuote ?? null;
            return (
              <Link key={r.id} to={`/rfq/${r.id}`}>
                <Card className="p-5 transition-all hover:border-border-strong hover:shadow-[var(--shadow-raised)]">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="num text-xs font-extrabold text-muted-foreground">{r.reference}</span>
                        <RfqStatusBadge status={r.status} />
                      </div>
                      <h3 className="mt-1.5 text-sm font-extrabold text-foreground">{t(r.title)}</h3>
                      <p className="num mt-1.5 text-xs text-muted-foreground">
                        {n(r.qty)} {r.unit} · {r.deliveryCity} · {t(d.rfq.neededBy)} {date(r.neededBy)}
                      </p>
                    </div>
                    <div className="text-end">
                      <div className="num text-sm font-extrabold text-foreground">
                        {n(quoteCount)} {t(d.rfq.quotesReceived)}
                      </div>
                      {best != null && (
                        <div className="num mt-1 text-[11px] font-semibold text-success">
                          {t(d.search.sort.price_asc)}: {money(best)}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RfqListPage() {
  return (
    <RequireAuth>
      <RfqListInner />
    </RequireAuth>
  );
}
