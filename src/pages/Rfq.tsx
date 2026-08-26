import { useState } from "react";
import { FileText, Plus } from "lucide-react";
import { Link } from "../app/router";
import { useDatabase } from "../app/usePlatform";
import { useI18n } from "../i18n";
import { auth, rfq } from "../platform/api";
import { RfqStatusBadge } from "../components/StatusBadge";
import { Button, Card, EmptyState, Select } from "../ui";
import RequireAuth from "./RequireAuth";
import type { RfqStatus } from "../platform/types";

const statuses: (RfqStatus | "all")[] = ["all", "open", "quoted", "awarded", "closed", "expired"];

function RfqListInner() {
  const { d, t, n, money, date } = useI18n();
  useDatabase();
  const [filter, setFilter] = useState<RfqStatus | "all">("all");

  const user = auth.currentUser();
  const company = auth.currentCompany();

  const list =
    user?.role === "supplier" && company
      ? rfq.forSupplier(company.id.replace("co-", ""))
      : user?.role === "admin"
        ? rfq.all()
        : company
          ? rfq.forBuyer(company.id)
          : [];

  const filtered = filter === "all" ? list : list.filter((r) => r.status === filter);

  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{t(d.rfq.title)}</h1>
          <p className="num mt-1 text-sm text-muted-foreground">{n(filtered.length)}</p>
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

      {filtered.length === 0 ? (
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
            const quotes = rfq.quotesFor(r.id);
            const best = quotes.length ? Math.min(...quotes.map((q) => q.unitPrice)) : null;
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
                        {quotes.length} {t(d.rfq.quotesReceived)}
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
